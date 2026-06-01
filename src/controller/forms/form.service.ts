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
import { Model, PipelineStage, Types, UpdateQuery } from 'mongoose';
import { FindAllFormsResult } from './interfaces/find-all-forms.interface';

@Injectable()
export class FormService {
  constructor(
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
  ) {}

  async create(createFormDto: CreateFormDto, userId?: string): Promise<Form> {
    const { questions, ...formData } = createFormDto;
    const mergedQuestions = this.mergeWithDefaultQuestions(
      this.sanitizeQuestionsOptions(questions),
    );

    // Create all questions and build refs with contiguous order
    const questionRefs = await Promise.all(
      mergedQuestions.map(async (q, index) => {
        const newQuestion = new this.questionModel(q);
        const savedQ = await newQuestion.save();
        return { question: savedQ._id, order: index };
      }),
    );

    const createdForm = new this.formModel({
      ...formData,
      questions: questionRefs,
      userId: createFormDto.userId || userId,
    });
    const savedForm = await createdForm.save();
    const form = savedForm.toObject() as Form;
    return form;
  }

  async findAll(query: QueryFormDto): Promise<FindAllFormsResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const orderedQuestionStages = this.getOrderedQuestionStages();

      const dataPipeline: PipelineStage[] = limit
        ? [{ $skip: skip }, { $limit: limit }, ...orderedQuestionStages]
        : [...orderedQuestionStages];

      const [result] = await this.formModel
        .aggregate<{
          data: Form[];
          totalCount: [{ count: number }];
        }>([
          { $match: { isDeleted: false } },
          {
            $facet: {
              data: dataPipeline as PipelineStage.FacetPipelineStage[],
              totalCount: [
                { $count: 'count' },
              ] as PipelineStage.FacetPipelineStage[],
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
    const result = await this.formModel
      .aggregate<Form>([
        { $match: { _id: new Types.ObjectId(id), isDeleted: false } },
        ...this.getOrderedQuestionStages(),
      ])
      .exec();
    const form = result[0];
    if (!form) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }
    return form;
  }

  async update(id: string, updateFormDto: UpdateFormDto): Promise<Form> {
    const { questions, ...formData } = updateFormDto;
    const updateData: UpdateQuery<Form> = { ...formData };

    if (questions) {
      const mergedQuestions = this.mergeWithDefaultQuestions(
        this.sanitizeQuestionsOptions(questions),
      );
      const questionRefs = await Promise.all(
        mergedQuestions.map(async (q, index) => {
          const newQuestion = new this.questionModel(q);
          const savedQ = await newQuestion.save();
          return { question: savedQ._id, order: index };
        }),
      );
      updateData.questions = questionRefs;
    }

    const updatedForm = await this.formModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        updateData,
        { new: true },
      )
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

  private getOrderedQuestionStages(): PipelineStage[] {
    return [
      {
        $unwind: { path: '$questions', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'questions',
          localField: 'questions.question',
          foreignField: '_id',
          as: 'questionDoc',
        },
      },
      {
        $unwind: { path: '$questionDoc', preserveNullAndEmptyArrays: true },
      },
      { $addFields: { 'questionDoc.order': '$questions.order' } },
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
              cond: { $ne: ['$$this', null] },
            },
          },
        },
      },
      { $project: { questionDoc: 0 } },
    ];
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
        isDefault: true,
      },
      {
        type: QuestionType.StarRating,
        title: 'Staff',
        isRequired: true,
        maxRatings: 5,
        starStep: 1,
        hint: 'Please rate our staff',
        isDefault: true,
      },
      {
        type: QuestionType.StarRating,
        title: 'Speed',
        isRequired: true,
        maxRatings: 5,
        starStep: 1,
        hint: 'Please rate our speed of service',
        isDefault: true,
      },
      {
        type: QuestionType.StarRating,
        title: 'Cleanliness',
        isRequired: true,
        maxRatings: 5,
        starStep: 1,
        hint: 'Please rate our cleanliness',
        isDefault: true,
      },
      {
        type: QuestionType.StarRating,
        title: 'Quality',
        isRequired: true,
        maxRatings: 5,
        starStep: 1,
        hint: 'Please rate our quality',
        isDefault: true,
      },
      {
        type: QuestionType.Paragraph,
        title: 'Overall experience at the store',
        isRequired: false,
        hint: 'Tell us about your overall experience at the store',
        isDefault: true,
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

  private sanitizeQuestionsOptions(
    questions?: CreateFormDto['questions'],
  ): CreateFormDto['questions'] | undefined {
    if (!questions) {
      return questions;
    }

    return questions.map((question) => {
      if (!question.options) {
        return question;
      }

      return {
        ...question,
        options: question.options.map((option) => ({
          text: option.text,
        })),
      };
    });
  }
}
