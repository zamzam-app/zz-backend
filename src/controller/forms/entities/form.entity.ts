import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Question } from '../../question/entities/question.entity';

export type FormDocument = HydratedDocument<Form>;

@Schema({ timestamps: true })
export class Form {
  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ required: true })
  title: string;

  @Prop({ nullable: true, type: Number })
  version: number;

  @Prop({
    required: true,
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Question' }],
  })
  questions: Question[];

  _id: Types.ObjectId;
}

export const FormSchema = SchemaFactory.createForClass(Form);
