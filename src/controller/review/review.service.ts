import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateReviewDto } from './dto/create-review.dto';
import { SubmitReviewWithOtpDto } from './dto/submit-review-with-otp.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { QueryRatingsSummaryDto } from './dto/query-ratings-summary.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import {
  normalizeEmail,
  normalizePhoneNumber,
} from '../../util/normalize.util';
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
import { FindAllReviewsResult } from './interfaces/query-review.interface';
import { UsersService } from '../users/users.service';
import { TwilioVerifyService } from '../../integrations/twilio/twilio-verify.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { User, UserDocument } from '../users/entities/user.entity';
import { Outlet, OutletDocument } from '../outlet/entities/outlet.entity';
import { UserRole } from '../users/interfaces/user.interface';

const VALID_MAX_RATINGS = new Set([3, 5, 10]);
const OVERALL_RATING_SCALE = { min: 1, max: 5 };

type RatingsSummaryBreakdownItem = {
  rating: number;
  count: number;
  percentage: number;
};

type RatingsSummaryResult = {
  averageRating: number;
  totalReviews: number;
  maxRating: number;
  ratingBreakdown: RatingsSummaryBreakdownItem[];
};

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(OutletTable.name)
    private outletTableModel: Model<OutletTableDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Outlet.name) private outletModel: Model<OutletDocument>,
    private usersService: UsersService,
    private twilioVerifyService: TwilioVerifyService,
    private notificationsService: NotificationsService,
  ) {}

  async submitWithOtp(
    dto: SubmitReviewWithOtpDto,
  ): Promise<{ overallRating: number }> {
    const normPhone = normalizePhoneNumber(dto.phoneNumber);
    if (!normPhone) {
      throw new UnauthorizedException('Invalid OTP');
    }
    await this.twilioVerifyService.verifyOtp(normPhone, dto.otp);

    const userId = (
      (await this.usersService.findOneOrCreateForReview({
        phoneNumber: normPhone,
      })) as { _id: Types.ObjectId } | null
    )?._id?.toString();
    if (!userId) throw new UnauthorizedException('Invalid OTP');

    const profileUpdate: { name?: string; email?: string; dob?: string } = {};
    if (dto.name !== undefined) profileUpdate.name = dto.name;
    if (dto.dob !== undefined) profileUpdate.dob = dto.dob;
    if (dto.email !== undefined && dto.email !== null) {
      const emailToCheck = normalizeEmail(dto.email);
      if (emailToCheck) {
        const emailTaken = await this.usersService.isEmailTakenByAnotherUser(
          emailToCheck,
          userId,
        );
        if (!emailTaken) profileUpdate.email = emailToCheck;
      }
    }
    if (Object.keys(profileUpdate).length > 0) {
      try {
        await this.usersService.update(userId, profileUpdate);
      } catch (error) {
        const err = error as { code?: number };
        if (err?.code === 11000) {
          throw new BadRequestException(
            'This email is already linked to another account.',
          );
        }
        throw error;
      }
    }

    const createReviewDto: CreateReviewDto = {
      formId: dto.formId,
      outletId: dto.outletId,
      userId,
      response: dto.response,
      ...(dto.outletTableId && { outletTableId: dto.outletTableId }),
      ...(dto.isComplaint !== undefined && { isComplaint: dto.isComplaint }),
      ...(dto.complaintReason && { complaintReason: dto.complaintReason }),
    };

    const savedReview = await this.create(createReviewDto);

    await this.usersService.update(userId, {
      lastLoginAt: new Date().toISOString(),
    });

    return { overallRating: savedReview.overallRating };
  }

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

      if (savedReview.isComplaint) {
        // Find Admins
        const admins = await this.userModel.find({
          role: UserRole.ADMIN,
          pushToken: { $ne: null },
        });

        // Find Outlet Managers
        const outlet = await this.outletModel.findById(savedReview.outletId);
        const managerIds = outlet?.managerIds ?? [];
        const managers =
          managerIds.length > 0
            ? await this.userModel.find({
                _id: { $in: managerIds },
                pushToken: { $ne: null },
              })
            : [];

        const tokens = [
          ...admins.map((a) => a.pushToken as string),
          ...managers.map((m) => m.pushToken as string),
        ].filter(Boolean);

        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length > 0) {
          const outletName = outlet?.name ?? 'an outlet';
          await this.notificationsService.sendPush(
            uniqueTokens,
            'New Complaint',
            `New complaint at ${outletName}`,
            { type: 'complaint', reviewId: savedReview._id.toString() },
          );
        }
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
              { $project: { _id: 1, name: 1, phoneNumber: 1 } },
            ],
            as: 'userIdLookup',
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
              {
                $project: {
                  _id: 1,
                  type: 1,
                  title: 1,
                  options: 1,
                  maxRatings: 1,
                },
              },
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
            $lookup: {
              from: 'outlets',
              let: { oid: { $toObjectId: { $toString: '$outletId' } } },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$_id', '$$oid'] },
                    isDeleted: false,
                  },
                },
                { $project: { _id: 1, name: 1 } },
              ],
              as: 'outletIdLookup',
            },
          },
          {
            $addFields: {
              outletId: { $arrayElemAt: ['$outletIdLookup', 0] },
            },
          },
          { $match: { outletId: { $ne: null } } }, // Filter out reviews with deleted outlets BEFORE counting
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

  async getRatingsSummary(
    query: QueryRatingsSummaryDto,
  ): Promise<RatingsSummaryResult> {
    try {
      const matchStage: Record<string, unknown> = { isDeleted: false };
      if (query.outletId) {
        matchStage.outletId = new Types.ObjectId(query.outletId);
      }

      const [result] = await this.reviewModel
        .aggregate<{
          summary: { totalReviews: number; averageRating: number }[];
          distribution: { rating: number; count: number }[];
        }>([
          { $match: matchStage },
          {
            $facet: {
              summary: [
                {
                  $group: {
                    _id: null,
                    totalReviews: { $sum: 1 },
                    averageRating: { $avg: '$overallRating' },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    totalReviews: 1,
                    averageRating: 1,
                  },
                },
              ],
              distribution: [
                {
                  $project: {
                    rating: {
                      $toInt: {
                        $min: [
                          OVERALL_RATING_SCALE.max,
                          {
                            $max: [
                              OVERALL_RATING_SCALE.min,
                              { $round: ['$overallRating', 0] },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  $group: {
                    _id: '$rating',
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    rating: '$_id',
                    count: 1,
                  },
                },
              ],
            },
          },
        ])
        .exec();

      const totalReviews = result?.summary[0]?.totalReviews ?? 0;
      const averageRatingRaw = result?.summary[0]?.averageRating ?? 0;
      const averageRating = Math.round(averageRatingRaw * 10) / 10;

      const distributionMap = new Map(
        (result?.distribution ?? []).map((item) => [item.rating, item.count]),
      );

      const ratingBreakdown = Array.from(
        { length: OVERALL_RATING_SCALE.max },
        (_, index) => {
          const rating = OVERALL_RATING_SCALE.max - index;
          const count = distributionMap.get(rating) ?? 0;
          const percentage =
            totalReviews === 0
              ? 0
              : Math.round((count / totalReviews) * 1000) / 10;
          return { rating, count, percentage };
        },
      );

      return {
        averageRating,
        totalReviews,
        maxRating: OVERALL_RATING_SCALE.max,
        ratingBreakdown,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch ratings summary',
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
                { $project: { _id: 1, name: 1, phoneNumber: 1 } },
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
                    isDeleted: false,
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
          { $match: { outletId: { $ne: null } } },
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
                { $project: { _id: 1, name: 1, phoneNumber: 1 } },
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
                    isDeleted: false,
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
          { $match: { outletId: { $ne: null } } },
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

      if (dto.images || dto.videos || dto.audios || dto.files) {
        $set.resolutionAttachments = {
          images: dto.images ?? [],
          videos: dto.videos ?? [],
          audios: dto.audios ?? [],
          files: dto.files ?? [],
        };
      }

      const updated = await this.reviewModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(reviewId),
            isDeleted: false,
          },
          { $set },
          { new: true },
        )
        .exec();

      if (!updated) {
        throw new NotFoundException('Review not found');
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
}
