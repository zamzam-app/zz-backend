import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryCsatTrendlineDto } from './dto/query-csat-trendline.dto';
import {
  AnalyticsPeriod,
  QueryGlobalCsatDto,
} from './dto/query-global-csat.dto';
import { QueryIncidentsOverviewDto } from './dto/query-incidents-overview.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import {
  ComplaintStatus,
  Review,
  ReviewDocument,
  UserResponse,
} from './entities/review.entity';
import { Form, FormDocument } from '../forms/entities/form.entity';
import {
  Question,
  QuestionDocument,
  QuestionType,
} from '../question/entities/question.entity';
import {
  OutletTable,
  OutletTableDocument,
} from '../outlet-table/entities/outlet-table.entity';
import { Outlet, OutletDocument } from '../outlet/entities/outlet.entity';
import { FindAllReviewsResult } from './interfaces/query-review.interface';
import { UsersService } from '../users/users.service';
import { QueryOutletFeedbackDto } from './dto/query-outlet-feedback.dto';
import { QueryQuickInsightsDto } from './dto/query-quick-insights.dto';

const VALID_MAX_RATINGS = new Set([3, 5, 10]);
const OVERALL_RATING_SCALE = { min: 1, max: 5 };
const PERIOD_DAYS_MAP: Record<AnalyticsPeriod, number> = {
  [AnalyticsPeriod.DAILY]: 1,
  [AnalyticsPeriod.WEEKLY]: 7,
  [AnalyticsPeriod.MONTHLY]: 30,
};
const PEAK_WINDOW_HOURS = 3;

type GlobalCsatResult = {
  globalCsatScore: number;
  averageOverallRating: number;
  totalRatings: number;
  totalScore: number;
  period?: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
};

type CsatTrendlinePeriodResult = {
  startDate: string;
  endDate: string;
  labels: string[];
  values: number[];
  totalRatings: number;
};

type CsatTrendlineResult = {
  period: AnalyticsPeriod;
  currentPeriod: CsatTrendlinePeriodResult;
  previousPeriod: CsatTrendlinePeriodResult;
};

type IncidentsOverviewResult = {
  totalOpenIncidents: number;
  criticalIssues: number;
  incidentsResolvedToday: number;
  resolvedTodayDate: string;
  period?: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
};

type OutletFeedbackSummaryItem = {
  outletId: string;
  outletName: string;
  negativeFeedbacks: number;
  totalFeedbacks: number;
  resolvedFeedbacks: number;
};

type OutletFeedbackSummaryResult = {
  items: OutletFeedbackSummaryItem[];
  negativeFeedbacksRanked: OutletFeedbackSummaryItem[];
  totalFeedbacksRanked: OutletFeedbackSummaryItem[];
  resolvedFeedbacksRanked: OutletFeedbackSummaryItem[];
  period?: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
};

type PeakIncidentTimeResult = {
  label: string;
  startTime: string;
  endTime: string;
  timeZone: 'IST';
  totalIncidents: number;
};

type MostImprovedOutletResult = {
  outletId: string | null;
  outletName: string;
  improvement: number;
  currentAverage: number;
  previousAverage: number;
};

type CriticalFocusAreaResult = {
  outletId: string | null;
  outletName: string;
  criticalIssues: number;
};

type QuickInsightsResult = {
  peakIncidentTime: PeakIncidentTimeResult;
  mostImprovedOutlet: MostImprovedOutletResult;
  criticalFocusArea: CriticalFocusAreaResult;
  period?: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
};

type AnalyticsRangeQuery = {
  period?: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
};

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(OutletTable.name)
    private outletTableModel: Model<OutletTableDocument>,
    @InjectModel(Outlet.name) private outletModel: Model<OutletDocument>,
    private usersService: UsersService,
  ) {}

  async create(createReviewDto: CreateReviewDto): Promise<Review> {
    try {
      // DTO fields are validated at runtime; types may be widened by decorators
      const userId: string | undefined = createReviewDto.userId as
        | string
        | undefined;
      const phoneNumber: string | undefined = createReviewDto.phoneNumber;
      const resolvedUser: { _id: Types.ObjectId } | null =
        userId || phoneNumber
          ? await this.usersService.findOneOrCreateForReview({
              userId,
              phoneNumber,
            })
          : null;

      const form = await this.formModel.findById(createReviewDto.formId);
      if (!form) {
        throw new NotFoundException('Form not found');
      }

      const userResponses: UserResponse[] = createReviewDto.response.map(
        (r) => ({
          questionId: new Types.ObjectId(r.questionId),
          answer: r.answer,
        }),
      );

      const overallRating = await this.computeOverallRatingFromResponses(
        createReviewDto.response,
      );

      const doc: Partial<Review> & {
        userId: string;
        outletId: string;
        userResponses: UserResponse[];
        overallRating: number;
        formId: string;
        outletTableId: Types.ObjectId | null;
      } = {
        userId: resolvedUser?._id?.toString() ?? createReviewDto.userId,
        outletId: createReviewDto.outletId,
        userResponses,
        overallRating,
        formId: createReviewDto.formId,
        outletTableId: null,
        // Complaint fields: optional in DTO, explicit defaults so they are never empty
        isComplaint: createReviewDto.isComplaint ?? false,
        complaintStatus:
          createReviewDto.complaintStatus ?? ComplaintStatus.PENDING,
        complaintReason: createReviewDto.complaintReason ?? null,
        resolvedAt: createReviewDto.resolvedAt
          ? new Date(createReviewDto.resolvedAt)
          : null,
        resolvedBy: createReviewDto.resolvedBy
          ? new Types.ObjectId(createReviewDto.resolvedBy)
          : null,
        resolutionNotes: createReviewDto.resolutionNotes ?? null,
      };

      if (createReviewDto.outletTableId) {
        const table = await this.outletTableModel.findOne({
          _id: createReviewDto.outletTableId,
          isDeleted: false,
        });

        if (!table) {
          throw new NotFoundException('Outlet table not found');
        }

        if (table.outletId.toString() !== createReviewDto.outletId) {
          throw new BadRequestException('Table does not belong to this outlet');
        }

        doc.outletTableId = new Types.ObjectId(createReviewDto.outletTableId);
      }

      const createdReview = new this.reviewModel(doc);
      const savedReview = await createdReview.save();

      if (resolvedUser) {
        await this.usersService.addUserReview(
          resolvedUser._id.toString(),
          savedReview._id.toString(),
        );
      }

      return savedReview;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to create review',
      );
    }
  }

  async findAll(query: QueryReviewDto): Promise<FindAllReviewsResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const matchStage: Record<string, unknown> = { isDeleted: false };
      if (query.outletId) {
        matchStage.outletId = new Types.ObjectId(query.outletId);
      }
      if (query.userId) {
        matchStage.userId = new Types.ObjectId(query.userId);
      }

      const lookupStages = [
        {
          $lookup: {
            from: 'users',
            let: { uid: '$userId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$uid'] } } },
              { $project: { _id: 1, name: 1 } },
            ],
            as: 'userIdLookup',
          },
        },
        {
          $lookup: {
            from: 'outlets',
            let: { oid: { $toObjectId: { $toString: '$outletId' } } },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$oid'] } } },
              { $project: { _id: 1, name: 1 } },
            ],
            as: 'outletIdLookup',
          },
        },
        {
          $lookup: {
            from: 'outlettables',
            let: { tid: '$outletTableId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$tid'] } } },
              { $project: { id: '$_id', name: 1, tableToken: 1, _id: 0 } },
            ],
            as: 'outletTableIdLookup',
          },
        },
        {
          $addFields: {
            userId: { $arrayElemAt: ['$userIdLookup', 0] },
            outletId: { $arrayElemAt: ['$outletIdLookup', 0] },
          },
        },
        { $project: { userIdLookup: 0, outletIdLookup: 0, outletIdObj: 0 } },
        {
          $lookup: {
            from: 'questions',
            let: {
              ids: {
                $map: {
                  input: '$userResponses',
                  as: 'ur',
                  in: '$$ur.questionId',
                },
              },
            },
            pipeline: [
              { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
              { $project: { _id: 1, title: 1 } },
            ],
            as: 'questionsLookup',
          },
        },
        {
          $addFields: {
            userResponses: {
              $map: {
                input: '$userResponses',
                as: 'ur',
                in: {
                  $mergeObjects: [
                    '$$ur',
                    {
                      questionId: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$questionsLookup',
                              as: 'q',
                              cond: { $eq: ['$$q._id', '$$ur.questionId'] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        { $project: { questionsLookup: 0 } },
      ];

      const dataPipeline = [
        ...(limit ? [{ $skip: skip }, { $limit: limit }] : []),
        ...lookupStages,
      ];

      const [result] = await this.reviewModel
        .aggregate<{
          data: Review[];
          totalCount: [{ count: number }];
        }>([
          { $match: matchStage },
          {
            $facet: {
              data: dataPipeline,
              totalCount: [{ $count: 'count' }],
            },
          },
        ])
        .exec();

      const total = result.totalCount[0]?.count ?? 0;
      const effectiveLimit = limit ?? total;

      return {
        data: result.data,
        meta: {
          total,
          currentPage: limit ? page : 1,
          hasPrevPage: limit ? page > 1 : false,
          hasNextPage: limit ? page * limit < total : false,
          limit: effectiveLimit,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch reviews',
      );
    }
  }

  async findOne(id: string): Promise<Review> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid review ID');
      }

      const [review] = await this.reviewModel
        .aggregate<Review>([
          {
            $match: {
              _id: new Types.ObjectId(id),
              isDeleted: false,
            },
          },
          { $limit: 1 },
          {
            $lookup: {
              from: 'users',
              let: { uid: '$userId' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$uid'] } } },
                { $project: { _id: 1, name: 1 } },
              ],
              as: 'userIdLookup',
            },
          },
          {
            $lookup: {
              from: 'outlets',
              let: { oid: '$outletId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [{ $toString: '$_id' }, { $toString: '$$oid' }],
                    },
                  },
                },
                {
                  $lookup: {
                    from: 'outlettypes',
                    let: { ot: '$outletType' },
                    pipeline: [
                      {
                        $match: { $expr: { $eq: ['$_id', '$$ot'] } },
                      },
                      { $project: { _id: 1, name: 1 } },
                    ],
                    as: 'outletTypeLookup',
                  },
                },
                {
                  $addFields: {
                    outletType: {
                      $arrayElemAt: ['$outletTypeLookup', 0],
                    },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    name: 1,
                    address: 1,
                    outletType: 1,
                  },
                },
              ],
              as: 'outletIdLookup',
            },
          },
          {
            $lookup: {
              from: 'outlettables',
              let: { tid: '$outletTableId' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$tid'] } } },
                { $project: { id: '$_id', name: 1, tableToken: 1, _id: 0 } },
              ],
              as: 'outletTableIdLookup',
            },
          },
          {
            $addFields: {
              userId: { $arrayElemAt: ['$userIdLookup', 0] },
              outletId: { $arrayElemAt: ['$outletIdLookup', 0] },
              outletTableId: {
                $cond: [
                  { $gt: [{ $size: '$outletTableIdLookup' }, 0] },
                  { $arrayElemAt: ['$outletTableIdLookup', 0] },
                  null,
                ],
              },
            },
          },
          {
            $project: {
              userIdLookup: 0,
              outletIdLookup: 0,
              outletTableIdLookup: 0,
            },
          },
        ])
        .exec();

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      return review;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch review',
      );
    }
  }

  async update(id: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid review ID');
      }

      const existingReview = await this.reviewModel.findById(id);
      if (!existingReview || existingReview.isDeleted) {
        throw new NotFoundException('Review not found');
      }

      const updateData: Record<string, unknown> = { ...updateReviewDto };

      if (updateReviewDto.response) {
        updateData.userResponses = updateReviewDto.response.map((r) => ({
          questionId: new Types.ObjectId(r.questionId),
          answer: r.answer,
        }));
        delete updateData.response;
        updateData.overallRating = await this.computeOverallRatingFromResponses(
          updateReviewDto.response,
        );
      }
      delete updateData.totalRatings;
      if (!updateReviewDto.response) {
        delete updateData.overallRating;
      }

      const updated = await this.reviewModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();

      if (!updated) {
        throw new NotFoundException('Review not found');
      }

      const [updatedReview] = await this.reviewModel
        .aggregate<Review>([
          {
            $match: {
              _id: new Types.ObjectId(id),
              isDeleted: false,
            },
          },
          { $limit: 1 },
          {
            $lookup: {
              from: 'users',
              let: { uid: '$userId' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$uid'] } } },
                { $project: { _id: 1, name: 1 } },
              ],
              as: 'userIdLookup',
            },
          },
          {
            $lookup: {
              from: 'outlets',
              let: { oid: '$outletId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [{ $toString: '$_id' }, { $toString: '$$oid' }],
                    },
                  },
                },
                {
                  $lookup: {
                    from: 'outlettypes',
                    let: { ot: '$outletType' },
                    pipeline: [
                      {
                        $match: { $expr: { $eq: ['$_id', '$$ot'] } },
                      },
                      { $project: { _id: 1, name: 1 } },
                    ],
                    as: 'outletTypeLookup',
                  },
                },
                {
                  $addFields: {
                    outletType: {
                      $arrayElemAt: ['$outletTypeLookup', 0],
                    },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    name: 1,
                    address: 1,
                    outletType: 1,
                  },
                },
              ],
              as: 'outletIdLookup',
            },
          },
          {
            $lookup: {
              from: 'outlettables',
              let: { tid: '$outletTableId' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$tid'] } } },
                { $project: { id: '$_id', name: 1, tableToken: 1, _id: 0 } },
              ],
              as: 'outletTableIdLookup',
            },
          },
          {
            $addFields: {
              userId: { $arrayElemAt: ['$userIdLookup', 0] },
              outletId: { $arrayElemAt: ['$outletIdLookup', 0] },
              outletTableId: {
                $cond: [
                  { $gt: [{ $size: '$outletTableIdLookup' }, 0] },
                  { $arrayElemAt: ['$outletTableIdLookup', 0] },
                  null,
                ],
              },
            },
          },
          {
            $project: {
              userIdLookup: 0,
              outletIdLookup: 0,
              outletTableIdLookup: 0,
            },
          },
        ])
        .exec();

      if (!updatedReview) {
        throw new NotFoundException('Review not found');
      }
      return updatedReview;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to update review',
      );
    }
  }

  async remove(id: string): Promise<Review> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid review ID');
      }

      const review = await this.reviewModel.findById(id);
      if (!review || review.isDeleted) {
        throw new NotFoundException('Review not found');
      }

      review.isDeleted = true;
      await review.save();

      return review;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to delete review',
      );
    }
  }

  // to compute overall rating from user responses
  private async computeOverallRatingFromResponses(
    response: { questionId: string; answer: string | string[] | number }[],
  ): Promise<number> {
    if (!response?.length) return OVERALL_RATING_SCALE.min;

    const questionIds = response.map((r) => r.questionId);
    const questions = await this.questionModel
      .find({ _id: { $in: questionIds.map((id) => new Types.ObjectId(id)) } })
      .lean()
      .exec();

    const questionMap = new Map(
      questions.map((q) => [
        (q as { _id: Types.ObjectId })._id.toString(),
        q as { type: string; maxRatings?: number },
      ]),
    );

    const normalizedValues: number[] = [];

    for (const r of response) {
      const question = questionMap.get(r.questionId);
      if (
        !question ||
        (question.type as QuestionType) !== QuestionType.StarRating
      )
        continue;

      let maxRatings = question.maxRatings;
      if (maxRatings == null || !VALID_MAX_RATINGS.has(maxRatings)) {
        maxRatings = 5;
      }

      let num: number;
      if (typeof r.answer === 'number') {
        num = r.answer;
      } else if (Array.isArray(r.answer)) {
        num = Number(r.answer[0]);
      } else {
        num = Number(r.answer);
      }
      if (Number.isNaN(num)) {
        throw new BadRequestException('Star rating answer must be a number');
      }

      num = Math.min(maxRatings, Math.max(1, num));
      const normalized =
        1 +
        ((num - 1) / (maxRatings - 1)) *
          (OVERALL_RATING_SCALE.max - OVERALL_RATING_SCALE.min);
      normalizedValues.push(normalized);
    }

    if (normalizedValues.length === 0) return OVERALL_RATING_SCALE.min;

    const sum = normalizedValues.reduce((a, b) => a + b, 0);
    const average = sum / normalizedValues.length;
    const rounded = Math.round(average * 10) / 10;
    return Math.min(
      OVERALL_RATING_SCALE.max,
      Math.max(OVERALL_RATING_SCALE.min, rounded),
    );
  }

  async resolveComplaint(
    reviewId: string,
    dto: ResolveComplaintDto,
  ): Promise<Review> {
    try {
      if (!Types.ObjectId.isValid(reviewId)) {
        throw new BadRequestException('Invalid review ID');
      }

      const resolvedByObj = new Types.ObjectId(dto.resolvedBy);
      const now = new Date();

      const $set: Record<string, unknown> = {
        complaintStatus: dto.complaintStatus,
        resolvedAt: now,
        resolvedBy: resolvedByObj,
      };
      if (dto.resolutionNotes !== undefined) {
        $set.resolutionNotes = dto.resolutionNotes;
      }

      const updated = await this.reviewModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(reviewId),
            isDeleted: false,
            isComplaint: true,
          },
          { $set },
          { new: true },
        )
        .exec();

      if (!updated) {
        throw new NotFoundException('Review not found or not a complaint');
      }

      return this.findOne(reviewId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to resolve complaint',
      );
    }
  }

  async getGlobalCsat(query: QueryGlobalCsatDto): Promise<GlobalCsatResult> {
    try {
      const { period, appliedStartDate, appliedEndDate } =
        this.resolveAnalyticsRange(query);
      const matchStage: Record<string, unknown> = { isDeleted: false };

      if (appliedStartDate && appliedEndDate) {
        matchStage.createdAt = {
          $gte: appliedStartDate,
          $lte: appliedEndDate,
        };
      }

      const [summary] = await this.reviewModel
        .aggregate<{
          totalRatings: number;
          totalScore: number;
          averageOverallRating: number;
        }>([
          { $match: matchStage },
          {
            $group: {
              _id: null,
              totalRatings: { $sum: 1 },
              totalScore: { $sum: '$overallRating' },
              averageOverallRating: { $avg: '$overallRating' },
            },
          },
          {
            $project: {
              _id: 0,
              totalRatings: 1,
              totalScore: 1,
              averageOverallRating: 1,
            },
          },
        ])
        .exec();

      const totalRatings = summary?.totalRatings ?? 0;
      const totalScore = summary?.totalScore ?? 0;
      const averageOverallRatingRaw = summary?.averageOverallRating ?? 0;
      const averageOverallRating =
        Math.round(averageOverallRatingRaw * 10) / 10;

      return {
        globalCsatScore: averageOverallRating,
        averageOverallRating,
        totalRatings,
        totalScore: Math.round(totalScore * 10) / 10,
        ...(period ? { period } : {}),
        ...(appliedStartDate
          ? { startDate: appliedStartDate.toISOString() }
          : {}),
        ...(appliedEndDate ? { endDate: appliedEndDate.toISOString() } : {}),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch global CSAT',
      );
    }
  }

  async getIncidentsOverview(
    query: QueryIncidentsOverviewDto,
  ): Promise<IncidentsOverviewResult> {
    try {
      const { period, appliedStartDate, appliedEndDate } =
        this.resolveAnalyticsRange(query);

      const selectedRangeMatch: Record<string, unknown> = {
        isDeleted: false,
        isComplaint: true,
      };

      if (appliedStartDate && appliedEndDate) {
        selectedRangeMatch.createdAt = {
          $gte: appliedStartDate,
          $lte: appliedEndDate,
        };
      }

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
      todayEnd.setMilliseconds(todayEnd.getMilliseconds() - 1);

      const [result] = await this.reviewModel
        .aggregate<{
          totalOpenIncidents: { count: number }[];
          criticalIssues: { count: number }[];
          incidentsResolvedToday: { count: number }[];
        }>([
          {
            $facet: {
              totalOpenIncidents: [
                {
                  $match: {
                    ...selectedRangeMatch,
                    complaintStatus: ComplaintStatus.PENDING,
                  },
                },
                { $count: 'count' },
              ],
              criticalIssues: [
                {
                  $match: {
                    ...selectedRangeMatch,
                    complaintStatus: ComplaintStatus.PENDING,
                    overallRating: { $lt: 2 },
                  },
                },
                { $count: 'count' },
              ],
              incidentsResolvedToday: [
                {
                  $match: {
                    isDeleted: false,
                    isComplaint: true,
                    complaintStatus: ComplaintStatus.RESOLVED,
                    resolvedAt: {
                      $gte: todayStart,
                      $lte: todayEnd,
                    },
                  },
                },
                { $count: 'count' },
              ],
            },
          },
        ])
        .exec();

      return {
        totalOpenIncidents: result?.totalOpenIncidents?.[0]?.count ?? 0,
        criticalIssues: result?.criticalIssues?.[0]?.count ?? 0,
        incidentsResolvedToday: result?.incidentsResolvedToday?.[0]?.count ?? 0,
        resolvedTodayDate: todayStart.toISOString().slice(0, 10),
        ...(period ? { period } : {}),
        ...(appliedStartDate
          ? { startDate: appliedStartDate.toISOString() }
          : {}),
        ...(appliedEndDate ? { endDate: appliedEndDate.toISOString() } : {}),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch incidents overview',
      );
    }
  }

  async getOutletFeedbackSummary(
    query: QueryOutletFeedbackDto,
  ): Promise<OutletFeedbackSummaryResult> {
    try {
      const { period, appliedStartDate, appliedEndDate } =
        this.resolveAnalyticsRange(query);

      const createdAtMatch =
        appliedStartDate && appliedEndDate
          ? { $gte: appliedStartDate, $lte: appliedEndDate }
          : null;
      const resolvedAtMatch =
        appliedStartDate && appliedEndDate
          ? { $gte: appliedStartDate, $lte: appliedEndDate }
          : null;

      const outlets = await this.outletModel
        .aggregate<OutletFeedbackSummaryItem>([
          { $match: { isDeleted: false } },
          { $project: { name: 1 } },
          {
            $lookup: {
              from: 'reviews',
              let: { outletId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$outletId', '$$outletId'] },
                    isDeleted: false,
                  },
                },
                {
                  $facet: {
                    totalFeedbacks: [
                      ...(createdAtMatch
                        ? [{ $match: { createdAt: createdAtMatch } }]
                        : []),
                      { $count: 'count' },
                    ],
                    negativeFeedbacks: [
                      {
                        $match: {
                          $or: [
                            { isComplaint: true },
                            { overallRating: { $lt: 2.5 } },
                          ],
                          ...(createdAtMatch
                            ? { createdAt: createdAtMatch }
                            : {}),
                        },
                      },
                      { $count: 'count' },
                    ],
                    resolvedFeedbacks: [
                      {
                        $match: {
                          isComplaint: true,
                          complaintStatus: ComplaintStatus.RESOLVED,
                          ...(resolvedAtMatch
                            ? { resolvedAt: resolvedAtMatch }
                            : {}),
                        },
                      },
                      { $count: 'count' },
                    ],
                  },
                },
              ],
              as: 'feedbackStats',
            },
          },
          {
            $addFields: {
              feedbackStats: { $arrayElemAt: ['$feedbackStats', 0] },
            },
          },
          {
            $addFields: {
              totalFeedbacks: {
                $ifNull: [
                  { $arrayElemAt: ['$feedbackStats.totalFeedbacks.count', 0] },
                  0,
                ],
              },
              negativeFeedbacks: {
                $ifNull: [
                  {
                    $arrayElemAt: ['$feedbackStats.negativeFeedbacks.count', 0],
                  },
                  0,
                ],
              },
              resolvedFeedbacks: {
                $ifNull: [
                  {
                    $arrayElemAt: ['$feedbackStats.resolvedFeedbacks.count', 0],
                  },
                  0,
                ],
              },
            },
          },
          {
            $project: {
              _id: 0,
              outletId: { $toString: '$_id' },
              outletName: '$name',
              negativeFeedbacks: 1,
              totalFeedbacks: 1,
              resolvedFeedbacks: 1,
            },
          },
          { $sort: { outletName: 1 } },
        ])
        .exec();

      const items = outlets ?? [];
      const sortByOutletName = (
        a: OutletFeedbackSummaryItem,
        b: OutletFeedbackSummaryItem,
      ) => a.outletName.localeCompare(b.outletName);
      const itemsByTotalReviews = [...items].sort((a, b) => {
        if (b.totalFeedbacks !== a.totalFeedbacks) {
          return b.totalFeedbacks - a.totalFeedbacks;
        }
        return sortByOutletName(a, b);
      });
      const negativeFeedbacksRanked = [...items].sort((a, b) => {
        if (b.negativeFeedbacks !== a.negativeFeedbacks) {
          return b.negativeFeedbacks - a.negativeFeedbacks;
        }
        return sortByOutletName(a, b);
      });
      const totalFeedbacksRanked = [...items].sort((a, b) => {
        if (b.totalFeedbacks !== a.totalFeedbacks) {
          return b.totalFeedbacks - a.totalFeedbacks;
        }
        return sortByOutletName(a, b);
      });
      const resolvedFeedbacksRanked = [...items].sort((a, b) => {
        if (b.resolvedFeedbacks !== a.resolvedFeedbacks) {
          return b.resolvedFeedbacks - a.resolvedFeedbacks;
        }
        return sortByOutletName(a, b);
      });

      return {
        items: itemsByTotalReviews,
        negativeFeedbacksRanked,
        totalFeedbacksRanked,
        resolvedFeedbacksRanked,
        ...(period ? { period } : {}),
        ...(appliedStartDate
          ? { startDate: appliedStartDate.toISOString() }
          : {}),
        ...(appliedEndDate ? { endDate: appliedEndDate.toISOString() } : {}),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch outlet feedback summary',
      );
    }
  }

  async getQuickInsights(
    query: QueryQuickInsightsDto,
  ): Promise<QuickInsightsResult> {
    try {
      let { period, appliedStartDate, appliedEndDate } =
        this.resolveAnalyticsRange(query);

      if (!appliedStartDate || !appliedEndDate) {
        const fallback = this.resolveAnalyticsRange({
          period: AnalyticsPeriod.MONTHLY,
        });
        period = fallback.period;
        appliedStartDate = fallback.appliedStartDate;
        appliedEndDate = fallback.appliedEndDate;
      }

      const rangeMatch =
        appliedStartDate && appliedEndDate
          ? { createdAt: { $gte: appliedStartDate, $lte: appliedEndDate } }
          : {};

      const peakIncidentTime = await this.getPeakIncidentTime(rangeMatch);

      const { mostImprovedOutlet } = await this.getMostImprovedOutlet({
        appliedStartDate,
        appliedEndDate,
      });

      const criticalFocusArea = await this.getCriticalFocusArea(rangeMatch);

      return {
        peakIncidentTime,
        mostImprovedOutlet,
        criticalFocusArea,
        ...(period ? { period } : {}),
        ...(appliedStartDate
          ? { startDate: appliedStartDate.toISOString() }
          : {}),
        ...(appliedEndDate ? { endDate: appliedEndDate.toISOString() } : {}),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch quick insights',
      );
    }
  }

  private async getPeakIncidentTime(
    rangeMatch: Record<string, unknown>,
  ): Promise<PeakIncidentTimeResult> {
    const rows = await this.reviewModel
      .aggregate<{ window: number; count: number }>([
        {
          $match: {
            isDeleted: false,
            $or: [{ isComplaint: true }, { overallRating: { $lt: 2.5 } }],
            ...rangeMatch,
          },
        },
        {
          $project: {
            hour: {
              $hour: { date: '$createdAt', timezone: 'Asia/Kolkata' },
            },
          },
        },
        {
          $addFields: {
            window: { $floor: { $divide: ['$hour', PEAK_WINDOW_HOURS] } },
          },
        },
        {
          $group: {
            _id: '$window',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            window: '$_id',
            count: 1,
          },
        },
      ])
      .exec();

    if (!rows.length) {
      return {
        label: 'No incidents',
        startTime: 'N/A',
        endTime: 'N/A',
        timeZone: 'IST',
        totalIncidents: 0,
      };
    }

    const top = rows.reduce(
      (best, current) => {
        if (!best) return current;
        if (current.count > best.count) return current;
        return best;
      },
      null as { window: number; count: number } | null,
    );

    const startHour = (top?.window ?? 0) * PEAK_WINDOW_HOURS;
    const endHour = (startHour + PEAK_WINDOW_HOURS) % 24;
    const startTime = this.formatIstHour(startHour);
    const endTime = this.formatIstHour(endHour);
    const windowLabel = this.getIstWindowLabel(startHour);

    return {
      label: `${startTime} - ${endTime} (${windowLabel} Window)`,
      startTime,
      endTime,
      timeZone: 'IST',
      totalIncidents: top?.count ?? 0,
    };
  }

  private async getMostImprovedOutlet({
    appliedStartDate,
    appliedEndDate,
  }: {
    appliedStartDate?: Date;
    appliedEndDate?: Date;
  }): Promise<{ mostImprovedOutlet: MostImprovedOutletResult }> {
    if (!appliedStartDate || !appliedEndDate) {
      return {
        mostImprovedOutlet: {
          outletId: null,
          outletName: 'Unknown Outlet',
          improvement: 0,
          currentAverage: 0,
          previousAverage: 0,
        },
      };
    }

    const durationMs = appliedEndDate.getTime() - appliedStartDate.getTime();
    const previousEnd = new Date(appliedStartDate.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - durationMs);

    const currentRows = await this.reviewModel
      .aggregate<{
        outletId: string;
        outletName: string;
        avgRating: number;
      }>([
        {
          $match: {
            isDeleted: false,
            createdAt: { $gte: appliedStartDate, $lte: appliedEndDate },
          },
        },
        {
          $group: {
            _id: '$outletId',
            avgRating: { $avg: '$overallRating' },
          },
        },
        {
          $lookup: {
            from: 'outlets',
            localField: '_id',
            foreignField: '_id',
            as: 'outlet',
          },
        },
        {
          $addFields: {
            outletName: {
              $ifNull: [
                { $arrayElemAt: ['$outlet.name', 0] },
                'Unknown Outlet',
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            outletId: { $toString: '$_id' },
            outletName: 1,
            avgRating: 1,
          },
        },
      ])
      .exec();

    if (!currentRows.length) {
      return {
        mostImprovedOutlet: {
          outletId: null,
          outletName: 'Unknown Outlet',
          improvement: 0,
          currentAverage: 0,
          previousAverage: 0,
        },
      };
    }

    const previousRows = await this.reviewModel
      .aggregate<{
        outletId: string;
        avgRating: number;
      }>([
        {
          $match: {
            isDeleted: false,
            createdAt: { $gte: previousStart, $lte: previousEnd },
          },
        },
        {
          $group: {
            _id: '$outletId',
            avgRating: { $avg: '$overallRating' },
          },
        },
        {
          $project: {
            _id: 0,
            outletId: { $toString: '$_id' },
            avgRating: 1,
          },
        },
      ])
      .exec();

    const previousMap = new Map(
      previousRows.map((row) => [row.outletId, row.avgRating ?? 0]),
    );

    let best: MostImprovedOutletResult | null = null;

    for (const row of currentRows) {
      const previousAvg = previousMap.get(row.outletId) ?? 0;
      const currentAvg = row.avgRating ?? 0;
      const improvement = currentAvg - previousAvg;
      const candidate: MostImprovedOutletResult = {
        outletId: row.outletId ?? null,
        outletName: row.outletName ?? 'Unknown Outlet',
        improvement: this.round1(improvement),
        currentAverage: this.round1(currentAvg),
        previousAverage: this.round1(previousAvg),
      };

      if (!best) {
        best = candidate;
        continue;
      }
      if (candidate.improvement > best.improvement) {
        best = candidate;
        continue;
      }
      if (
        candidate.improvement === best.improvement &&
        candidate.currentAverage > best.currentAverage
      ) {
        best = candidate;
      }
    }

    return {
      mostImprovedOutlet:
        best ??
        ({
          outletId: null,
          outletName: 'Unknown Outlet',
          improvement: 0,
          currentAverage: 0,
          previousAverage: 0,
        } as MostImprovedOutletResult),
    };
  }

  private async getCriticalFocusArea(
    rangeMatch: Record<string, unknown>,
  ): Promise<CriticalFocusAreaResult> {
    const rows = await this.reviewModel
      .aggregate<{
        outletId: string;
        outletName: string;
        criticalIssues: number;
      }>([
        {
          $match: {
            isDeleted: false,
            isComplaint: true,
            overallRating: { $lt: 2 },
            ...rangeMatch,
          },
        },
        {
          $group: {
            _id: '$outletId',
            criticalIssues: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'outlets',
            localField: '_id',
            foreignField: '_id',
            as: 'outlet',
          },
        },
        {
          $addFields: {
            outletName: {
              $ifNull: [
                { $arrayElemAt: ['$outlet.name', 0] },
                'Unknown Outlet',
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            outletId: { $toString: '$_id' },
            outletName: 1,
            criticalIssues: 1,
          },
        },
        { $sort: { criticalIssues: -1, outletName: 1 } },
        { $limit: 1 },
      ])
      .exec();

    if (!rows.length) {
      return {
        outletId: null,
        outletName: 'Unknown Outlet',
        criticalIssues: 0,
      };
    }

    const top = rows[0];
    return {
      outletId: top.outletId ?? null,
      outletName: top.outletName ?? 'Unknown Outlet',
      criticalIssues: top.criticalIssues ?? 0,
    };
  }

  private formatIstHour(hour24: number): string {
    const normalized = ((hour24 % 24) + 24) % 24;
    const suffix = normalized >= 12 ? 'PM' : 'AM';
    const hour12 = normalized % 12 || 12;
    const padded = hour12.toString().padStart(2, '0');
    return `${padded}:00 ${suffix}`;
  }

  private getIstWindowLabel(startHour: number): string {
    const hour = ((startHour % 24) + 24) % 24;
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
  }

  private round1(value: number): number {
    return Math.round((value ?? 0) * 10) / 10;
  }

  private resolveAnalyticsRange(query: AnalyticsRangeQuery): {
    period?: AnalyticsPeriod;
    appliedStartDate?: Date;
    appliedEndDate?: Date;
  } {
    const { period, startDate, endDate } = query;
    let appliedStartDate: Date | undefined;
    let appliedEndDate: Date | undefined;

    if ((startDate && !endDate) || (!startDate && endDate)) {
      throw new BadRequestException(
        'startDate and endDate must be provided together',
      );
    }

    if (startDate && endDate) {
      appliedStartDate = new Date(startDate);
      appliedEndDate = new Date(endDate);
    } else if (period) {
      const days = PERIOD_DAYS_MAP[period];
      appliedEndDate = new Date();
      appliedStartDate = new Date(appliedEndDate);
      appliedStartDate.setUTCDate(appliedStartDate.getUTCDate() - (days - 1));
      appliedStartDate.setUTCHours(0, 0, 0, 0);
    }

    if (
      (appliedStartDate && Number.isNaN(appliedStartDate.getTime())) ||
      (appliedEndDate && Number.isNaN(appliedEndDate.getTime()))
    ) {
      throw new BadRequestException('Invalid date range');
    }

    if (
      appliedStartDate &&
      appliedEndDate &&
      appliedStartDate > appliedEndDate
    ) {
      throw new BadRequestException('startDate must be before endDate');
    }

    return { period, appliedStartDate, appliedEndDate };
  }

  async getCsatTrendline(
    query: QueryCsatTrendlineDto,
  ): Promise<CsatTrendlineResult> {
    try {
      const period = query.period ?? AnalyticsPeriod.MONTHLY;
      const now = new Date();

      const {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
        bucketCount,
        labels,
      } = this.getTrendlineConfig(period, now);

      const currentPeriod = await this.aggregateTrendlineWindow(
        currentStart,
        currentEnd,
        bucketCount,
        labels,
      );

      const previousPeriod = await this.aggregateTrendlineWindow(
        previousStart,
        previousEnd,
        bucketCount,
        labels,
      );

      return {
        period,
        currentPeriod,
        previousPeriod,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch CSAT trendline',
      );
    }
  }

  private getTrendlineConfig(
    period: AnalyticsPeriod,
    now: Date,
  ): {
    currentStart: Date;
    currentEnd: Date;
    previousStart: Date;
    previousEnd: Date;
    bucketCount: number;
    labels: string[];
  } {
    if (period === AnalyticsPeriod.DAILY) {
      const currentStart = new Date(now);
      currentStart.setUTCHours(0, 0, 0, 0);

      const currentEnd = now;
      const previousStart = new Date(currentStart);
      previousStart.setUTCDate(previousStart.getUTCDate() - 1);
      const previousEnd = new Date(currentEnd);
      previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);

      const bucketCount = 6;
      const labels = this.buildTimeLabels(
        currentStart,
        currentEnd,
        bucketCount,
      );
      return {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
        bucketCount,
        labels,
      };
    }

    if (period === AnalyticsPeriod.WEEKLY) {
      const currentEnd = now;
      const currentStart = new Date(currentEnd);
      currentStart.setUTCDate(currentStart.getUTCDate() - 6);
      currentStart.setUTCHours(0, 0, 0, 0);

      const previousEnd = new Date(currentStart);
      previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);
      const previousStart = new Date(previousEnd);
      previousStart.setUTCDate(previousStart.getUTCDate() - 6);
      previousStart.setUTCHours(0, 0, 0, 0);

      const bucketCount = 7;
      const labels = this.buildDateLabels(
        currentStart,
        currentEnd,
        bucketCount,
      );
      return {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
        bucketCount,
        labels,
      };
    }

    const currentEnd = now;
    const currentStart = new Date(currentEnd);
    currentStart.setUTCDate(currentStart.getUTCDate() - 29);
    currentStart.setUTCHours(0, 0, 0, 0);

    const previousEnd = new Date(currentStart);
    previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setUTCDate(previousStart.getUTCDate() - 29);
    previousStart.setUTCHours(0, 0, 0, 0);

    const bucketCount = 6;
    const labels = this.buildDateLabels(currentStart, currentEnd, bucketCount);
    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
      bucketCount,
      labels,
    };
  }

  private buildDateLabels(
    start: Date,
    end: Date,
    bucketCount: number,
  ): string[] {
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      timeZone: 'UTC',
    });
    const labels: string[] = [];
    const span = end.getTime() - start.getTime();
    const denominator = Math.max(1, bucketCount - 1);
    const stepMs = Math.max(1, span / denominator);

    for (let i = 0; i < bucketCount; i += 1) {
      const point = new Date(start.getTime() + stepMs * i);
      labels.push(formatter.format(point));
    }
    return labels;
  }

  private buildTimeLabels(
    start: Date,
    end: Date,
    bucketCount: number,
  ): string[] {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    });
    const labels: string[] = [];
    const span = end.getTime() - start.getTime();
    const denominator = Math.max(1, bucketCount - 1);
    const stepMs = Math.max(1, span / denominator);

    for (let i = 0; i < bucketCount; i += 1) {
      const point = new Date(start.getTime() + stepMs * i);
      labels.push(formatter.format(point));
    }
    return labels;
  }

  private async aggregateTrendlineWindow(
    start: Date,
    end: Date,
    bucketCount: number,
    labels: string[],
  ): Promise<CsatTrendlinePeriodResult> {
    const startMs = start.getTime();
    const endMs = end.getTime();
    const bucketMs = Math.max(1, (endMs - startMs) / bucketCount);

    const rows = await this.reviewModel
      .aggregate<{
        bucketIndex: number;
        avgCsat: number;
        totalRatings: number;
      }>([
        {
          $match: {
            isDeleted: false,
            createdAt: {
              $gte: start,
              $lte: end,
            },
          },
        },
        {
          $addFields: {
            bucketIndex: {
              $min: [
                bucketCount - 1,
                {
                  $floor: {
                    $divide: [
                      {
                        $subtract: [{ $toLong: '$createdAt' }, startMs],
                      },
                      bucketMs,
                    ],
                  },
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: '$bucketIndex',
            avgCsat: { $avg: '$overallRating' },
            totalRatings: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            bucketIndex: '$_id',
            avgCsat: 1,
            totalRatings: 1,
          },
        },
      ])
      .exec();

    const values = Array.from({ length: bucketCount }, () => 0);
    const ratingsPerBucket = Array.from({ length: bucketCount }, () => 0);

    for (const row of rows) {
      if (row.bucketIndex < 0 || row.bucketIndex >= bucketCount) continue;
      const rounded = Math.round((row.avgCsat ?? 0) * 10) / 10;
      values[row.bucketIndex] = rounded;
      ratingsPerBucket[row.bucketIndex] = row.totalRatings ?? 0;
    }

    const totalRatings = ratingsPerBucket.reduce(
      (sum, count) => sum + count,
      0,
    );

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      labels,
      values,
      totalRatings,
    };
  }
}
