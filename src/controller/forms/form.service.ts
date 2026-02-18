import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { InjectModel } from '@nestjs/mongoose';
import {
  Form,
  FormDocument,
  Question,
  QuestionDocument,
} from './entities/form.entity';
import { Model, Types, UpdateQuery } from 'mongoose';

@Injectable()
export class FormService {
  constructor(
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
  ) {}

  async create(createFormDto: CreateFormDto, userId?: string): Promise<Form> {
    const { questions, ...formData } = createFormDto;

    // Create all questions first
    const questionIds = await Promise.all(
      (questions || []).map(async (q) => {
        const newQuestion = new this.questionModel(q);
        const savedQ = await newQuestion.save();
        return savedQ._id;
      }),
    );

    const createdForm = new this.formModel({
      ...formData,
      questions: questionIds,
      userId: createFormDto.userId || userId,
    });
    const savedForm = await createdForm.save();
    return savedForm.populate('questions');
  }

  async findAll(): Promise<Form[]> {
    return this.formModel
      .find({ isDeleted: false })
      .populate('questions')
      .exec();
  }

  async findOne(id: string): Promise<Form> {
    const form = await this.formModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .populate('questions')
      .exec();
    if (!form) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }

    return form;
  }

  async update(id: string, updateFormDto: UpdateFormDto): Promise<Form> {
    const { questions, ...formData } = updateFormDto;
    const updateData: UpdateQuery<Form> = { ...formData };

    if (questions) {
      const questionIds = await Promise.all(
        questions.map(async (q) => {
          const newQuestion = new this.questionModel(q);
          const savedQ = await newQuestion.save();
          return savedQ._id;
        }),
      );
      updateData.questions = questionIds;
    }

    const updatedForm = await this.formModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        updateData,
        { new: true },
      )
      .populate('questions')
      .exec();

    if (!updatedForm) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }
    return updatedForm;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.formModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        { isDeleted: true },
      )
      .exec();
    if (!result) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }
    return { message: 'Form deleted successfully' };
  }
}
