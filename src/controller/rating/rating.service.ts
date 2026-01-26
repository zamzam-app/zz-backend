import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRatingDto, ResponseDto } from './dto/create-rating.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';
import { Rating, RatingDocument } from './entities/rating.entity';
import {
  Form,
  FormDocument,
  Question,
  QuestionType,
} from '../forms/entities/form.entity';

@Injectable()
export class RatingService {
  constructor(
    @InjectModel(Rating.name) private ratingModel: Model<RatingDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
  ) {}

  async create(createRatingDto: CreateRatingDto): Promise<Rating> {
    // Validate form exists
    const form = await this.formModel.findById(createRatingDto.formId);
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    // Calculate totalRatings (average of star ratings from responses)
    const totalRatings = this.calculateAverageRating(
      createRatingDto.response,
      form.questions,
    );

    const createdRating = new this.ratingModel({
      ...createRatingDto,
      totalRatings,
    });
    return createdRating.save();
  }

  async findAll(): Promise<Rating[]> {
    return this.ratingModel
      .find({ isDeleted: false })
      .populate('formId')
      .populate('userId')
      .populate('outletId')
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

    // If response is being updated, recalculate totalRatings
    const updateData: UpdateRatingDto = { ...updateRatingDto };
    if (updateRatingDto.response) {
      const form = await this.formModel.findById(existingRating.formId);
      if (!form) {
        throw new NotFoundException('Associated form not found');
      }

      updateData.totalRatings = this.calculateAverageRating(
        updateRatingDto.response,
        form.questions,
      );
    }

    const updatedRating = await this.ratingModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('formId')
      .populate('userId')
      .populate('outletId')
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

  private calculateAverageRating(
    responses: ResponseDto[],
    questions: Question[],
  ): number {
    const starRatingResponses = responses.filter((response) => {
      const question = questions.find(
        (q) => q._id.toString() === response.questionId.toString(),
      );
      return question && question.type === QuestionType.StarRating;
    });

    if (starRatingResponses.length === 0) {
      return 0;
    }

    const totalRating = starRatingResponses.reduce((sum, response) => {
      const rating = typeof response.answer === 'number' ? response.answer : 0;
      return sum + rating;
    }, 0);

    return totalRating / starRatingResponses.length;
  }
}
