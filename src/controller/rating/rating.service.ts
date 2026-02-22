import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRatingDto } from './dto/create-rating.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';
import { Rating, RatingDocument } from './entities/rating.entity';
import { Form, FormDocument } from '../forms/entities/form.entity';
import { Question, QuestionType } from '../question/entities/question.entity';

@Injectable()
export class RatingService {
  constructor(
    @InjectModel(Rating.name) private ratingModel: Model<RatingDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
  ) {}

  async create(createRatingDto: CreateRatingDto): Promise<Rating> {
    const form = await this.formModel
      .findById(createRatingDto.formId)
      .populate('questions');
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    const userResponses = createRatingDto.response.map((r) => ({
      questionId: new Types.ObjectId(r.questionId),
      answer: r.answer,
      ...(r.isComplaint !== undefined && { isComplaint: r.isComplaint }),
    }));

    const overallRating = this.resolveOverallRating(
      createRatingDto,
      form.questions as (Question & { _id: Types.ObjectId })[],
    );

    const doc = {
      userId: createRatingDto.userId,
      outletId: createRatingDto.outletId,
      userResponses,
      overallRating,
      formId: createRatingDto.formId,
      ...(createRatingDto.type && { type: createRatingDto.type }),
    };

    const createdRating = new this.ratingModel(doc);
    return createdRating.save();
  }

  private resolveOverallRating(
    dto: CreateRatingDto,
    questions: (Question & { _id: Types.ObjectId })[],
  ): number {
    if (dto.overallRating != null) {
      return dto.overallRating;
    }
    if (dto.totalRatings != null) {
      return Math.min(5, Math.max(1, Math.round(dto.totalRatings)));
    }
    const ratingQuestion = questions.find(
      (q) => q.type === QuestionType.StarRating,
    );
    if (ratingQuestion) {
      const response = dto.response.find(
        (r) => r.questionId === ratingQuestion._id.toString(),
      );
      if (response != null && typeof response.answer === 'number') {
        return Math.min(5, Math.max(1, Math.round(response.answer)));
      }
    }
    return 1;
  }

  async findAll(): Promise<Rating[]> {
    return this.ratingModel
      .find({ isDeleted: false })
      .populate('formId')
      .populate('userId')
      .populate('outletId')
      .populate('userResponses.questionId')
      .exec();
  }

  async findOne(id: string): Promise<Rating> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid rating ID');
    }

    const rating = await this.ratingModel
      .findById(id)
      .populate('formId')
      .populate('userId')
      .populate('outletId')
      .populate('userResponses.questionId')
      .exec();

    if (!rating || rating.isDeleted) {
      throw new NotFoundException('Rating not found');
    }

    return rating;
  }

  async update(id: string, updateRatingDto: UpdateRatingDto): Promise<Rating> {
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

      if (updateRatingDto.overallRating == null) {
        const form = await this.formModel
          .findById(existingRating.formId)
          .populate('questions');
        if (form) {
          updateData.overallRating = this.resolveOverallRating(
            {
              ...updateRatingDto,
              response: updateRatingDto.response,
            } as CreateRatingDto,
            form.questions as (Question & { _id: Types.ObjectId })[],
          );
        }
      }
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

    const updatedRating = await this.ratingModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('formId')
      .populate('userId')
      .populate('outletId')
      .populate('userResponses.questionId')
      .exec();

    if (!updatedRating) {
      throw new NotFoundException('Rating not found');
    }

    return updatedRating;
  }

  async remove(id: string): Promise<Rating> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid rating ID');
    }

    const rating = await this.ratingModel.findById(id);
    if (!rating || rating.isDeleted) {
      throw new NotFoundException('Rating not found');
    }

    // Soft delete
    rating.isDeleted = true;
    await rating.save();

    return rating;
  }

  // private calculateAverageRating(
  //   responses: ResponseDto[],
  //   questions: Question[],
  // ): number {
  //   const starRatingResponses = responses.filter((response) => {
  //     const question = questions.find(
  //       (q) => q._id.toString() === response.questionId.toString(),
  //     );
  //     return question && question.type === QuestionType.StarRating;
  //   });

  //   if (starRatingResponses.length === 0) {
  //     return 0;
  //   }

  //   const totalRating = starRatingResponses.reduce((sum, response) => {
  //     const rating = typeof response.answer === 'number' ? response.answer : 0;
  //     return sum + rating;
  //   }, 0);

  //   return totalRating / starRatingResponses.length;
  // }
}
