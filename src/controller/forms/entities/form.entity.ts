import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type FormDocument = HydratedDocument<Form>;

export enum FieldType {
  ShortAnswer = 'ShortAnswer',
  Paragraph = 'Paragraph',
  MultipleChoice = 'MultipleChoice',
  Checkboxes = 'Checkboxes',
  StarRating = 'StarRating',
}

export class FormField {
  @ApiProperty({
    example: 'field_1',
    description: 'Unique identifier for the field',
  })
  @Prop({ required: true })
  field_id: string;

  @ApiProperty({
    example: 'What is your name?',
    description: 'Label for the field',
  })
  @Prop({ required: true })
  field_label: string;

  @ApiProperty({
    example: FieldType.ShortAnswer,
    description: 'Type of the field',
    enum: FieldType,
  })
  @Prop({ required: true, enum: FieldType })
  field_type: FieldType;

  @ApiProperty({
    description:
      'Input value based on field type - string for ShortAnswer/Paragraph, string for MultipleChoice, string[] for Checkboxes, number for StarRating',
    required: false,
  })
  @Prop({ required: false })
  input?: string | string[] | number;
}

export const FormFieldSchema = SchemaFactory.createForClass(FormField);

@Schema({ timestamps: true })
export class Form extends BaseEntity {
  @ApiProperty({ example: 1, description: 'Version number of the form' })
  @Prop({ required: true, type: Number })
  version: number;

  @ApiProperty({
    example: [
      {
        field_id: 'field_1',
        field_label: 'What is your name?',
        field_type: FieldType.ShortAnswer,
        input: 'John Doe',
      },
      {
        field_id: 'field_2',
        field_label: 'Tell us about yourself',
        field_type: FieldType.Paragraph,
        input: 'I am a software developer...',
      },
      {
        field_id: 'field_3',
        field_label: 'What is your favorite color?',
        field_type: FieldType.MultipleChoice,
        input: 'Blue',
      },
      {
        field_id: 'field_4',
        field_label: 'What programming languages do you know?',
        field_type: FieldType.Checkboxes,
        input: ['JavaScript', 'TypeScript', 'Python'],
      },
      {
        field_id: 'field_5',
        field_label: 'Rate our service',
        field_type: FieldType.StarRating,
        input: 5,
      },
    ],
    description: 'Array of form fields',
    type: [FormField],
  })
  @Prop({ required: true, type: [FormFieldSchema] })
  fields: FormField[];

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated user ID',
    required: false,
  })
  @Prop({ type: Types.ObjectId, required: false })
  userId?: string;
}

export const FormSchema = SchemaFactory.createForClass(Form);
