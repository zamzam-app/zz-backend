import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type FormDocument = HydratedDocument<Form>;

export enum QuestionType {
  ShortAnswer = 'short_answer',
  Paragraph = 'paragraph',
  MultipleChoice = 'multiple_choice',
  Checkboxes = 'checkbox',
  StarRating = 'rating',
}

@Schema()
export class Option {
  @Prop({ required: true })
  text: string;
}

@Schema()
export class Question {
  @Prop({ required: true, enum: QuestionType })
  type: QuestionType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: false })
  hint?: string;

  @Prop({ required: false, type: [Object] })
  options?: Option[];

  @Prop({ required: true })
  isRequired: boolean;

  @Prop({ required: false })
  maxRatings?: number;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);

@Schema({ timestamps: true })
export class Form extends BaseEntity {
  @Prop({ required: true })
  title: string;

  @Prop({ nullable: true, type: Number })
  version: number;

  @Prop({ required: true, type: [QuestionSchema] })
  questions: Question[];
}

export const FormSchema = SchemaFactory.createForClass(Form);
