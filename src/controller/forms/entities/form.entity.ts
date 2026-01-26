import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
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

export class Option {
  @ApiProperty({
    example: 'Blue',
    description: 'Text of the option',
  })
  @Prop({ required: true })
  text: string;
}

export class Question {
  @ApiProperty({
    example: 'short_answer',
    description: 'Type of the question',
    enum: QuestionType,
  })
  @Prop({ required: true, enum: QuestionType })
  type: QuestionType;

  @ApiProperty({
    example: 'What is your name?',
    description: 'Title of the question',
  })
  @Prop({ required: true })
  title: string;

  @ApiProperty({
    example: 'Please enter your full name',
    description: 'Hint for the question',
    required: false,
  })
  @Prop({ required: false })
  hint?: string;

  @ApiProperty({
    example: [{ text: 'Option 1' }, { text: 'Option 2' }],
    description: 'Array of options for multiple choice or checkbox questions',
    type: [Object],
    required: false,
  })
  @Prop({ required: false, type: [Object] })
  options?: Option[];

  @ApiProperty({
    example: true,
    description: 'Whether the question is required',
  })
  @Prop({ required: true })
  isRequired: boolean;

  @ApiProperty({
    example: 5,
    description: 'Maximum rating for star rating questions',
    required: false,
  })
  @Prop({ required: false })
  maxRatings?: number;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);

@Schema({ timestamps: true })
export class Form extends BaseEntity {
  @ApiProperty({
    example: 'Customer Feedback Form',
    description: 'Title of the form',
  })
  @Prop({ required: true })
  title: string;

  @ApiProperty({ example: 1, description: 'Version number of the form' })
  @Prop({ nullable: true, type: Number })
  version: number;

  @ApiProperty({
    example: [
      {
        type: QuestionType.ShortAnswer,
        title: 'What is your name?',
        hint: 'Please enter your full name',
        isRequired: true,
      },
      {
        type: QuestionType.Paragraph,
        title: 'Tell us about yourself',
        isRequired: false,
      },
    ],
    description: 'Array of form questions',
    type: [Question],
  })
  @Prop({ required: true, type: [QuestionSchema] })
  questions: Question[];
}

export const FormSchema = SchemaFactory.createForClass(Form);
