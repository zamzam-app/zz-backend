import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

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

  @Prop({ required: true, default: false })
  selected?: boolean;
}

@Schema({ timestamps: true })
export class Question extends BaseEntity {
  @Prop({ required: true, enum: QuestionType })
  type: QuestionType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  isRequired: boolean;

  @Prop({ required: false, type: [Object] })
  options?: Option[];

  @Prop({ required: false })
  maxRatings?: number;

  @Prop({ required: false, type: Number, default: 1 })
  starStep?: number;

  @Prop({ required: false })
  hint?: string;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
