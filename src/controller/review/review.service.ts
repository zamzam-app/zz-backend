import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
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
import { Msg91Service } from '../../integrations/msg91/msg91.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { User, UserDocument } from '../users/entities/user.entity';
import {
  PendingComplaint,
  PendingComplaintDocument,
} from './entities/pending-complaint.entity';
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

type ReviewBadgeStatus = {
  unreadCount: number;
  pendingCount: number;
  hasUnread: boolean;
};

const COMPLAINT_NOTIFICATION_DEBOUNCE_MS = 120_000;

type PendingComplaintNotification = {
  timer: ReturnType<typeof setTimeout>;
  eventCount: number;
  outletName: string;
  tokens: Set<string>;
  reviewId: string;
};

@Injectable()
export class ReviewService implements OnModuleInit {
  private readonly logger = new Logger(ReviewService.name);

  private readonly pendingComplaints = new Map<
    string,
    PendingComplaintNotification
  >();

  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(OutletTable.name)
    private outletTableModel: Model<OutletTableDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Outlet.name) private outletModel: Model<OutletDocument>,
    @InjectModel(PendingComplaint.name)
    private pendingComplaintModel: Model<PendingComplaintDocument>,
    private usersService: UsersService,
    private msg91Service: Msg91Service,
    private notificationsService: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const pendingDocs = await this.pendingComplaintModel.find().lean().exec();

    if (pendingDocs.length === 0) {
      return;
    }

    this.logger.log(
      `Recovering ${pendingDocs.length} pending complaint notification(s) from the database.`,
    );

    for (const doc of pendingDocs) {
      const tokenSet = new Set(doc.tokens);

      const timer = setTimeout(() => {
        this.flushComplaintNotification(doc.outletId).catch((error) => {
          this.logger.error(
            `Failed to flush recovered complaint notification for outlet ${doc.outletId}`,
            error,
          );
        });
      }, COMPLAINT_NOTIFICATION_DEBOUNCE_MS);

      this.pendingComplaints.set(doc.outletId, {
        timer,
        eventCount: doc.eventCount,
        outletName: doc.outletName,
        tokens: tokenSet,
        reviewId: doc.reviewId,
      });
    }
  }

  private buildOpenComplaintMatch(): Record<string, unknown> {
    return {
      $or: [
        { complaintStatus: ComplaintStatus.PENDING },
        { complaintStatus: { $exists: false } },
        { complaintStatus: null },
      ],
    };
  }

  private getOrderedQuestionStages(): PipelineStage[] {
    return [
      {
        $unwind: {
          path: '$questions',
          includeArrayIndex: 'questionIndex',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          questionLookupId: { $ifNull: ['$questions.question', '$questions'] },
          questionOrder: { $ifNull: ['$questions.order', '$questionIndex'] },
        },
      },
      {
        $lookup: {
          from: 'questions',
          localField: 'questionLookupId',
          foreignField: '_id',
          as: 'questionDoc',
        },
      },
      {
        $unwind: { path: '$questionDoc', preserveNullAndEmptyArrays: true },
      },
      { $addFields: { 'questionDoc.order': '$questionOrder' } },
      { $sort: { 'questionDoc.order': 1 } },
      {
        $group: {
          _id: '$_id',
          doc: { $first: '$$ROOT' },
          questions: { $push: '$questionDoc' },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ['$doc', { questions: '$questions' }],
          },
        },
      },
      {
        $addFields: {
          questions: {
            $filter: {
              input: '$questions',
              cond: { $ne: [{ $ifNull: ['$$this._id', null] }, null] },
            },
          },
        },
      },
      {
        $project: {
          questionDoc: 0,
          questionIndex: 0,
          questionLookupId: 0,
          questionOrder: 0,
        },
      },
    ];
  }

  async submitWithOtp(
    dto: SubmitReviewWithOtpDto,
  ): Promise<{ overallRating: number }> {
    const normPhone = normalizePhoneNumber(dto.phoneNumber);
    if (!normPhone) {
      throw new UnauthorizedException('Invalid OTP');
    }
    await this.msg91Service.verifyOtp(normPhone, dto.otp);

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

      const [form] = await this.formModel
        .aggregate<{
          questions: QuestionDocument[];
        }>([
          { $match: { _id: new Types.ObjectId(createReviewDto.formId) } },
          ...this.getOrderedQuestionStages(),
        ])
        .exec();
      if (!form) {
        throw new NotFoundException('Form not found');
      }

      const providedAnswers = new Map(
        createReviewDto.response.map((r) => [r.questionId, r.answer]),
      );

      for (const question of form.questions) {
        if (question.isRequired) {
          const answer = providedAnswers.get(question._id.toString());
          if (
            answer === undefined ||
            answer === null ||
            answer === '' ||
            (Array.isArray(answer) && answer.length === 0)
          ) {
            throw new BadRequestException(
              `Response for required question '${question.title}' cannot be empty`,
            );
          }
        }
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
        const admins = await this.userModel
          .find(
            {
              role: UserRole.ADMIN,
            },
            '_id',
          )
          .lean();

        // Find Outlet Managers
        const outlet = await this.outletModel.findById(savedReview.outletId);
        const managerIds = outlet?.managerIds ?? [];

        const userIdsToNotify = [
          ...admins.map((a) => a._id.toString()),
          ...managerIds.map((id) => id.toString()),
        ];

        const uniqueTokens = await this.usersService.getPushTokensForUsers([
          ...new Set(userIdsToNotify),
        ]);

        if (uniqueTokens.length > 0) {
          const outletName = outlet?.name ?? 'an outlet';
          this.scheduleComplaintNotification(
            savedReview.outletId,
            outletName,
            uniqueTokens,
            savedReview._id.toString(),
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
      const hiddenOutletTypeIds = (process.env.HIDDEN_OUTLET_TYPE_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0 && Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

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
      if (typeof query.isComplaint === 'boolean') {
        matchStage.isComplaint = query.isComplaint;
      }
      if (query.complaintStatus === 'open') {
        Object.assign(matchStage, this.buildOpenComplaintMatch());
      } else if (query.complaintStatus) {
        matchStage.complaintStatus = query.complaintStatus;
      }
      if (query.unresolvedOnly || query.excludeResolved) {
        Object.assign(matchStage, this.buildOpenComplaintMatch());
      }
      if (query.severity === 'critical') {
        matchStage.overallRating = { $lt: 2 };
      } else if (query.severity === 'concern') {
        matchStage.overallRating = { $gte: 2, $lt: 3.5 };
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
                    ...(hiddenOutletTypeIds.length > 0
                      ? { outletType: { $nin: hiddenOutletTypeIds } }
                      : {}),
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

  async getBadgeStatus(userId: string): Promise<ReviewBadgeStatus> {
    try {
      const badgeScope = await this.getBadgeScopeForUser(userId);
      if (badgeScope.scopeType === 'none') {
        return { unreadCount: 0, pendingCount: 0, hasUnread: false };
      }

      const pendingMatch = this.buildPendingBadgeMatch(badgeScope.outletIds);
      const unreadMatch = {
        ...pendingMatch,
        readBy: {
          $not: {
            $elemMatch: {
              userId: new Types.ObjectId(userId),
            },
          },
        },
      };

      const [pendingCount, unreadCount] = await Promise.all([
        this.reviewModel.countDocuments(pendingMatch).exec(),
        this.reviewModel.countDocuments(unreadMatch).exec(),
      ]);

      return {
        unreadCount,
        pendingCount,
        hasUnread: unreadCount > 0,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to fetch review badge status', error);
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch review badge status',
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

  async markReviewAsRead(
    reviewId: string,
    userId: string,
  ): Promise<ReviewBadgeStatus> {
    try {
      if (!Types.ObjectId.isValid(reviewId)) {
        throw new BadRequestException('Invalid review ID');
      }

      const badgeScope = await this.getBadgeScopeForUser(userId);
      if (badgeScope.scopeType === 'none') {
        return { unreadCount: 0, pendingCount: 0, hasUnread: false };
      }

      const accessMatch = this.buildAccessibleReviewMatch(
        reviewId,
        badgeScope.outletIds,
      );
      const existing = await this.reviewModel
        .findOne(accessMatch)
        .select('_id')
        .lean()
        .exec();
      if (!existing) {
        throw new NotFoundException('Review not found');
      }

      await this.reviewModel
        .updateOne(
          {
            ...accessMatch,
            readBy: {
              $not: {
                $elemMatch: {
                  userId: new Types.ObjectId(userId),
                },
              },
            },
          },
          {
            $push: {
              readBy: {
                userId: new Types.ObjectId(userId),
                readAt: new Date(),
              },
            },
          },
        )
        .exec();

      this.logger.log(`Marked review ${reviewId} as read for user ${userId}.`);

      return this.getBadgeStatus(userId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to mark review as read', error);
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to mark review as read',
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
    response: { questionId: string; answer?: string | string[] | number }[],
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
        (question.type as QuestionType) !== QuestionType.StarRating ||
        r.answer === undefined ||
        r.answer === null ||
        r.answer === ''
      ) {
        continue;
      }

      let maxRatings = question.maxRatings;
      if (maxRatings == null || !VALID_MAX_RATINGS.has(maxRatings)) {
        maxRatings = 5;
      }

      let num: number;
      if (typeof r.answer === 'number') {
        num = r.answer;
      } else if (Array.isArray(r.answer)) {
        if (r.answer.length === 0) continue;
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

      // Only notify on an actual transition to RESOLVED, not on re-sends.
      const previousStatus = await this.reviewModel
        .findById(reviewId)
        .select('complaintStatus')
        .lean()
        .exec()
        .then((r) => r?.complaintStatus);

      if (
        dto.complaintStatus === ComplaintStatus.RESOLVED &&
        previousStatus !== ComplaintStatus.RESOLVED
      ) {
        try {
          const admins = await this.userModel
            .find(
              {
                role: UserRole.ADMIN,
              },
              '_id',
            )
            .lean();

          const adminTokens = await this.usersService.getPushTokensForUsers(
            admins.map((a) => a._id.toString()),
          );

          if (adminTokens.length > 0) {
            const outlet = await this.outletModel.findById(updated.outletId);
            const outletName = outlet?.name ?? 'an outlet';
            const manager = await this.userModel.findById(dto.resolvedBy);
            const managerName = manager?.name ?? 'a Manager';

            await this.notificationsService.sendPush(
              adminTokens,
              'Complaint Resolved',
              `A complaint at ${outletName} has been resolved by ${managerName}.`,
              { type: 'complaint', reviewId: updated._id.toString() },
            );
          }
        } catch (error) {
          this.logger.error(
            'Failed to send push notification for resolved complaint',
            error,
          );
        }
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

  private async getBadgeScopeForUser(userId: string): Promise<{
    scopeType: 'global' | 'outlets' | 'none';
    outletIds: Types.ObjectId[];
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel
      .findOne({ _id: new Types.ObjectId(userId), isDeleted: false })
      .select('_id role outlets')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      const activeOutlets = await this.outletModel
        .find({ isDeleted: false })
        .select('_id')
        .lean()
        .exec();

      if (activeOutlets.length === 0) {
        return { scopeType: 'none', outletIds: [] };
      }

      return {
        scopeType: 'global',
        outletIds: activeOutlets.map((o) => o._id),
      };
    }

    if (user.role !== UserRole.MANAGER) {
      return { scopeType: 'none', outletIds: [] };
    }

    const outletIds = new Set<string>(
      (user.outlets ?? []).map((id) => id.toString()),
    );

    const managerOutlets = await this.outletModel
      .find({
        isDeleted: false,
        managerIds: new Types.ObjectId(userId),
      } as Record<string, unknown>)
      .select('_id')
      .lean()
      .exec();

    managerOutlets.forEach((outlet) => outletIds.add(outlet._id.toString()));

    return {
      scopeType: outletIds.size > 0 ? 'outlets' : 'none',
      outletIds: Array.from(outletIds).map((id) => new Types.ObjectId(id)),
    };
  }

  private buildPendingBadgeMatch(
    outletIds: Types.ObjectId[],
  ): Record<string, unknown> {
    return {
      isDeleted: false,
      isComplaint: true,
      complaintStatus: ComplaintStatus.PENDING,
      ...(outletIds.length > 0 ? { outletId: { $in: outletIds } } : {}),
    };
  }

  private buildAccessibleReviewMatch(
    reviewId: string,
    outletIds: Types.ObjectId[],
  ): Record<string, unknown> {
    return {
      _id: new Types.ObjectId(reviewId),
      isDeleted: false,
      ...(outletIds.length > 0 ? { outletId: { $in: outletIds } } : {}),
    };
  }

  private scheduleComplaintNotification(
    outletId: string,
    outletName: string,
    tokens: string[],
    reviewId: string,
  ) {
    const existing = this.pendingComplaints.get(outletId);

    const tokenSet = existing ? existing.tokens : new Set<string>();
    tokens.forEach((t) => tokenSet.add(t));

    const eventCount = (existing ? existing.eventCount : 0) + 1;

    let timer = existing?.timer;

    if (!timer) {
      timer = setTimeout(() => {
        this.flushComplaintNotification(outletId).catch((error) => {
          this.logger.error(
            `Failed to flush batched complaint notifications for outlet ${outletId}`,
            error,
          );
        });
      }, COMPLAINT_NOTIFICATION_DEBOUNCE_MS);
    }

    this.pendingComplaints.set(outletId, {
      timer,
      eventCount,
      outletName,
      tokens: tokenSet,
      reviewId,
    });

    // Persist to MongoDB so the notification survives server restarts.
    this.pendingComplaintModel
      .updateOne(
        { outletId },
        {
          $set: {
            outletName,
            tokens: Array.from(tokenSet),
            eventCount,
            reviewId,
          },
          $setOnInsert: { outletId },
        },
        { upsert: true },
      )
      .exec()
      .catch((err) => {
        this.logger.warn(
          `Failed to persist pending complaint notification for outlet ${outletId}`,
          err,
        );
      });
  }

  private async flushComplaintNotification(outletId: string) {
    const pending = this.pendingComplaints.get(outletId);
    if (!pending) return;

    this.pendingComplaints.delete(outletId);

    // Remove the persisted record regardless of send outcome to avoid re-sending on restart.
    this.pendingComplaintModel
      .deleteOne({ outletId })
      .exec()
      .catch((err) => {
        this.logger.warn(
          `Failed to delete persisted pending complaint for outlet ${outletId}`,
          err,
        );
      });

    const { eventCount, outletName, tokens, reviewId } = pending;
    if (tokens.size === 0) return;

    const body =
      eventCount === 1
        ? `A customer at ${outletName} has raised a complaint.`
        : `${eventCount} new complaints have been raised at ${outletName}.`;

    try {
      await this.notificationsService.sendPush(
        Array.from(tokens),
        'New Complaint',
        body,
        { type: 'complaint', reviewId },
      );

      this.logger.log(
        `Sent batched complaint notification (${eventCount} event(s)) for outlet ${outletId} to ${tokens.size} user(s).`,
      );
    } catch (error) {
      this.logger.error('Failed to send batched complaint notification', error);
    }
  }
}
