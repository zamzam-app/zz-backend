import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRatingDto } from './dto/create-rating.dto';
import { QueryRatingDto } from './dto/query-rating.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';
import { Rating, RatingDocument } from './entities/rating.entity';
import { Form, FormDocument } from '../forms/entities/form.entity';
import { FindAllRatingsResult } from './interfaces/query-rating.interface';

@Injectable()
export class RatingService {
  constructor(
    @InjectModel(Rating.name) private ratingModel: Model<RatingDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
  ) {}

  async create(createRatingDto: CreateRatingDto): Promise<Rating> {
    try {
      const form = await this.formModel.findById(createRatingDto.formId);
      if (!form) {
        throw new NotFoundException('Form not found');
      }

      const userResponses = createRatingDto.response.map((r) => ({
        questionId: new Types.ObjectId(r.questionId),
        answer: r.answer,
        ...(r.isComplaint !== undefined && { isComplaint: r.isComplaint }),
      }));

      const doc = {
        userId: createRatingDto.userId,
        outletId: createRatingDto.outletId,
        userResponses,
        overallRating: createRatingDto.overallRating ?? 1,
        formId: createRatingDto.formId,
        ...(createRatingDto.type && { type: createRatingDto.type }),
        ...(createRatingDto.overallRating != null && {
          overallRating: createRatingDto.overallRating,
        }),
      };

      const createdRating = new this.ratingModel(doc);
      return await createdRating.save();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to create rating',
      );
    }
  }

  async findAll(query: QueryRatingDto): Promise<FindAllRatingsResult> {
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

      const [result] = await this.ratingModel
        .aggregate<{
          data: Rating[];
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
          'Failed to fetch ratings',
      );
    }
  }

  async findOne(id: string): Promise<Rating> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid rating ID');
      }

      const [rating] = await this.ratingModel
        .aggregate<Rating>([
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

      if (!rating) {
        throw new NotFoundException('Rating not found');
      }

      return rating;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch rating',
      );
    }
  }

  async update(id: string, updateRatingDto: UpdateRatingDto): Promise<Rating> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid rating ID');
      }

      const existingRating = await this.ratingModel.findById(id);
      if (!existingRating || existingRating.isDeleted) {
        throw new NotFoundException('Rating not found');
      }

      const updateData: Record<string, unknown> = { ...updateRatingDto };

      if (updateRatingDto.response) {
        updateData.userResponses = updateRatingDto.response.map((r) => ({
          questionId: new Types.ObjectId(r.questionId),
          answer: r.answer,
          ...(r.isComplaint !== undefined && { isComplaint: r.isComplaint }),
        }));
        delete updateData.response;
      }
      if (updateRatingDto.overallRating != null) {
        updateData.overallRating = updateRatingDto.overallRating;
      }
      if (
        updateRatingDto.totalRatings != null &&
        updateData.overallRating === undefined
      ) {
        updateData.overallRating = Math.min(
          5,
          Math.max(1, Math.round(updateRatingDto.totalRatings)),
        );
      }
      delete updateData.totalRatings;

      const updated = await this.ratingModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();

      if (!updated) {
        throw new NotFoundException('Rating not found');
      }

      const [updatedRating] = await this.ratingModel
        .aggregate<Rating>([
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

      if (!updatedRating) {
        throw new NotFoundException('Rating not found');
      }
      return updatedRating;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to update rating',
      );
    }
  }

  async resolveComplaint(
    ratingId: string,
    dto: ResolveComplaintDto,
  ): Promise<Rating> {
    try {
      if (!Types.ObjectId.isValid(ratingId)) {
        throw new BadRequestException('Invalid rating ID');
      }
      if (!Types.ObjectId.isValid(dto.questionId)) {
        throw new BadRequestException('Invalid question ID');
      }

      const questionIdObj = new Types.ObjectId(dto.questionId);
      const resolvedByObj = new Types.ObjectId(dto.resolvedBy);
      const now = new Date();

      const $set: Record<string, unknown> = {
        'userResponses.$.isComplaint': false,
        'userResponses.$.complaintStatus': dto.complaintStatus,
        'userResponses.$.resolvedAt': now,
        'userResponses.$.resolutionBy': resolvedByObj,
      };
      if (dto.resolutionNotes !== undefined) {
        $set['userResponses.$.resolutionNotes'] = dto.resolutionNotes;
      }
      if (dto.answer !== undefined) {
        $set['userResponses.$.answer'] = dto.answer;
      }

      const filter = {
        _id: new Types.ObjectId(ratingId),
        isDeleted: false,
        'userResponses.questionId': questionIdObj,
      };
      const updated = await this.ratingModel
        .findOneAndUpdate(
          filter as Record<string, unknown>,
          { $set },
          { new: true },
        )
        .exec();

      if (!updated) {
        throw new NotFoundException(
          'Rating not found or question not found in rating',
        );
      }

      return this.findOne(ratingId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to resolve complaint',
      );
    }
  }

  async remove(id: string): Promise<Rating> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid rating ID');
      }

      const rating = await this.ratingModel.findById(id);
      if (!rating || rating.isDeleted) {
        throw new NotFoundException('Rating not found');
      }

      rating.isDeleted = true;
      await rating.save();

      return rating;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to delete rating',
      );
    }
  }
}
