import { Injectable, NotFoundException } from '@nestjs/common';
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
    const created = new this.questionModel(createQuestionDto);
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
    const updated = await this.questionModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        updateQuestionDto,
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
}
