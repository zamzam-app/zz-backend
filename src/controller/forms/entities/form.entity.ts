import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Question } from '../../question/entities/question.entity';

export type FormDocument = HydratedDocument<Form>;

@Schema({ _id: false })
export class FormQuestionRef {
  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
    ref: 'Question',
  })
  question: Question;

  @Prop({ required: true, type: Number })
  order: number;
}

export const FormQuestionRefSchema =
  SchemaFactory.createForClass(FormQuestionRef);

@Schema({ timestamps: true })
export class Form extends BaseEntity {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, type: [FormQuestionRefSchema] })
  questions: FormQuestionRef[];

  // might remove this later.
  @Prop({ required: false, type: Number, default: 1 })
  version: number;
}

export const FormSchema = SchemaFactory.createForClass(Form);
