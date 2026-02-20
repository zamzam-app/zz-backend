import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QuestionDocument = HydratedDocument<Question>;

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

  @Prop({ required: false })
  selected?: boolean;
}

@Schema({ timestamps: true })
export class Question {
  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ required: true, enum: QuestionType })
  type: QuestionType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  isRequired: boolean;

  @Prop({ required: false })
  hint?: string;

  @Prop({ required: false, type: [Object] })
  options?: Option[];

  @Prop({ required: false })
  maxRatings?: number;

  _id: Types.ObjectId;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
