import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Question } from '../../question/entities/question.entity';

export type FormDocument = HydratedDocument<Form>;

@Schema({ timestamps: true })
export class Form extends BaseEntity {
  @Prop({ required: true })
  title: string;

  @Prop({
    required: true,
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Question' }],
  })
  questions: Question[];

  // might remove this later.
  @Prop({ required: false, type: Number, default: 1 })
  version: number;
}

export const FormSchema = SchemaFactory.createForClass(Form);
