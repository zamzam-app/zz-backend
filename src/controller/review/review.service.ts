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

const VALID_MAX_RATINGS = new Set([3, 5, 10]);
const OVERALL_RATING_SCALE = { min: 1, max: 5 };

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(OutletTable.name)
    private outletTableModel: Model<OutletTableDocument>,
    private usersService: UsersService,
  ) {}

  async submitWithOtp(
    dto: SubmitReviewWithOtpDto,
  ): Promise<{ overallRating: number }> {
    if (dto.otp !== '123456') {
      throw new UnauthorizedException('Invalid OTP');
    }
    const normPhone = normalizePhoneNumber(dto.phoneNumber);
    if (!normPhone) {
      throw new UnauthorizedException('Invalid OTP');
    }
    const userDoc = await this.usersService.findOneByPhoneNumber(normPhone);
    if (!userDoc) {
      throw new UnauthorizedException('Invalid OTP');
    }
    const userId = (
      userDoc as unknown as { _id: Types.ObjectId }
    )._id.toString();

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

    await this.usersService.clearOtp(userId);
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
              { $match: { $expr: { $eq: ['$_id', '$$oid'] } } },
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
