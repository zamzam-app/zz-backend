import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question, QuestionDocument } from './entities/question.entity';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionService {
  constructor(
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
  ) {}

  async create(createQuestionDto: CreateQuestionDto): Promise<Question> {
    const sanitizedQuestion = this.sanitizeQuestionOptions(createQuestionDto);
    const created = new this.questionModel(sanitizedQuestion);
    const saved = await created.save();
    return saved.toObject() as Question;
  }

  async findAll(): Promise<Question[]> {
    return this.questionModel
      .find({ isDeleted: false })
      .lean()
      .exec() as Promise<Question[]>;
  }

  async findOne(id: string): Promise<Question> {
    const question = await this.questionModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .lean()
      .exec();
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    return question as Question;
  }

  async update(
    id: string,
    updateQuestionDto: UpdateQuestionDto,
  ): Promise<Question> {
    const existingQuestion = await this.questionModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .lean()
      .exec();

    if (!existingQuestion) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    if (existingQuestion.isDefault) {
      throw new ForbiddenException('Default questions cannot be modified');
    }

    const sanitizedUpdate = this.sanitizeQuestionOptions(updateQuestionDto);
    const updated = await this.questionModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        sanitizedUpdate,
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    return updated as Question;
  }

  async remove(id: string): Promise<{ message: string }> {
    const existingQuestion = await this.questionModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .lean()
      .exec();

    if (!existingQuestion) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    if (existingQuestion.isDefault) {
      throw new ForbiddenException('Default questions cannot be deleted');
    }

    const result = await this.questionModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        { isDeleted: true },
      )
      .exec();
    if (!result) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    return { message: 'Question deleted successfully' };
  }

  private sanitizeQuestionOptions<
    T extends { options?: Array<{ text: string }> },
  >(question: T): T {
    if (!question.options) {
      return question;
    }

    return {
      ...question,
      options: question.options.map((option) => ({
        text: option.text,
      })),
    };
  }
}
