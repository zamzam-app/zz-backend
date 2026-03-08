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
import { QueryReviewDto } from './dto/query-review.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review, ReviewDocument } from './entities/review.entity';
import { Form, FormDocument } from '../forms/entities/form.entity';
import { FindAllReviewsResult } from './interfaces/query-review.interface';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
  ) {}

  async create(createReviewDto: CreateReviewDto): Promise<Review> {
    try {
      const form = await this.formModel.findById(createReviewDto.formId);
      if (!form) {
        throw new NotFoundException('Form not found');
      }

      const userResponses = createReviewDto.response.map((r) => ({
        questionId: new Types.ObjectId(r.questionId),
        answer: r.answer,
      }));

      const doc = {
        userId: createReviewDto.userId,
        outletId: createReviewDto.outletId,
        userResponses,
        overallRating: createReviewDto.overallRating ?? 1,
        formId: createReviewDto.formId,
        ...(createReviewDto.overallRating != null && {
          overallRating: createReviewDto.overallRating,
        }),
      };

      const createdReview = new this.reviewModel(doc);
      return await createdReview.save();
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
            let: { oid: '$outletId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$oid'] } } },
              { $project: { _id: 1, name: 1 } },
            ],
            as: 'outletIdLookup',
          },
        },
        {
          $addFields: {
            userId: { $arrayElemAt: ['$userIdLookup', 0] },
            outletId: { $arrayElemAt: ['$outletIdLookup', 0] },
          },
        },
        { $project: { userIdLookup: 0, outletIdLookup: 0 } },
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
                              cond: {
                                $eq: ['$$q._id', '$$ur.questionId'],
                              },
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
                { $match: { $expr: { $eq: ['$_id', '$$oid'] } } },
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
            $addFields: {
              userId: { $arrayElemAt: ['$userIdLookup', 0] },
              outletId: { $arrayElemAt: ['$outletIdLookup', 0] },
            },
          },
          { $project: { userIdLookup: 0, outletIdLookup: 0 } },
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
      }
      if (updateReviewDto.overallRating != null) {
        updateData.overallRating = updateReviewDto.overallRating;
      }
      if (
        updateReviewDto.totalRatings != null &&
        updateData.overallRating === undefined
      ) {
        updateData.overallRating = Math.min(
          5,
          Math.max(1, Math.round(updateReviewDto.totalRatings)),
        );
      }
      delete updateData.totalRatings;

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
                { $match: { $expr: { $eq: ['$_id', '$$oid'] } } },
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
            $addFields: {
              userId: { $arrayElemAt: ['$userIdLookup', 0] },
              outletId: { $arrayElemAt: ['$outletIdLookup', 0] },
            },
          },
          { $project: { userIdLookup: 0, outletIdLookup: 0 } },
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
}
