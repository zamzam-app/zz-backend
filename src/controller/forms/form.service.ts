import {
  Injectable,
  NotFoundException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { QueryFormDto } from './dto/query-form.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Form, FormDocument } from './entities/form.entity';
import {
  Question,
  QuestionDocument,
  QuestionType,
} from '../question/entities/question.entity';
import { Model, Types, UpdateQuery } from 'mongoose';
import { FindAllFormsResult } from './interfaces/find-all-forms.interface';

@Injectable()
export class FormService {
  constructor(
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
  ) {}

  async create(createFormDto: CreateFormDto, userId?: string): Promise<Form> {
    const { questions, ...formData } = createFormDto;
    const mergedQuestions = this.mergeWithDefaultQuestions(questions);

    // Create all questions first
    const questionIds = await Promise.all(
      mergedQuestions.map(async (q) => {
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
    const populatedForm = await savedForm.populate('questions');
    return populatedForm.toObject() as Form;
  }

  async findAll(query: QueryFormDto): Promise<FindAllFormsResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const dataPipeline = limit
        ? [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'questions',
                localField: 'questions',
                foreignField: '_id',
                as: 'questions',
              },
            },
          ]
        : [
            {
              $lookup: {
                from: 'questions',
                localField: 'questions',
                foreignField: '_id',
                as: 'questions',
              },
            },
          ];

      const [result] = await this.formModel
        .aggregate<{
          data: Form[];
          totalCount: [{ count: number }];
        }>([
          { $match: { isDeleted: false } },
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
        (error as Error)?.message ?? 'Failed to retrieve forms',
      );
    }
  }

  async findOne(id: string): Promise<Form> {
    const form = await this.formModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .populate('questions')
      .lean()
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
      const mergedQuestions = this.mergeWithDefaultQuestions(questions);
      const questionIds = await Promise.all(
        mergedQuestions.map(async (q) => {
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
      .lean()
      .exec();

    if (!updatedForm) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }
    return updatedForm as unknown as Form;
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

  private buildDefaultQuestions(): CreateFormDto['questions'] {
    return [
      {
        type: QuestionType.StarRating,
        title: 'Overall Experience',
        isRequired: true,
        maxRatings: 5,
        starStep: 1,
        hint: 'Please rate your overall experience',
      },
      {
        type: QuestionType.StarRating,
        title: 'Staff',
        isRequired: true,
        maxRatings: 5,
        starStep: 1,
        hint: 'Please rate our staff',
      },
      {
        type: QuestionType.StarRating,
        title: 'Speed',
        isRequired: true,
        maxRatings: 5,
        starStep: 1,
        hint: 'Please rate our speed of service',
      },
      {
        type: QuestionType.StarRating,
        title: 'Cleanliness',
        isRequired: true,
        maxRatings: 5,
        starStep: 1,
        hint: 'Please rate our cleanliness',
      },
      {
        type: QuestionType.StarRating,
        title: 'Quality',
        isRequired: true,
        maxRatings: 5,
        starStep: 1,
        hint: 'Please rate our quality',
      },
    ];
  }

  private mergeWithDefaultQuestions(
    questions?: CreateFormDto['questions'],
  ): CreateFormDto['questions'] {
    const defaultQuestions = this.buildDefaultQuestions();
    const combined = [...defaultQuestions, ...(questions ?? [])];
    const seen = new Set<string>();
    const deduped: CreateFormDto['questions'] = [];

    for (const q of combined) {
      const key = `${q.type}|${q.title.trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(q);
    }

    return deduped;
  }
}
