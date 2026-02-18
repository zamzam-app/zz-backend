import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Schema as MongooseSchema,
  type ObjectId,
} from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type RatingDocument = HydratedDocument<Rating>;

export enum RatingType {
  COMPLAINT = 'complaint',
  REVIEW = 'review',
}

@Schema()
export class Response {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: 'Question',
  })
  questionId: ObjectId;

  @Prop({ type: [String], required: true })
  answer: string | string[] | number;
}

export const ResponseSchema = SchemaFactory.createForClass(Response);

@Schema({ timestamps: true })
export class Rating extends BaseEntity {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Form',
    required: true,
  })
  formId: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Outlet',
    required: true,
  })
  outletId: string;

  @Prop({ required: true, type: [ResponseSchema] })
  response: Response[];

  @Prop({ required: true, type: Number })
  totalRatings: number;

  @Prop({
    type: String,
    enum: RatingType,
    default: RatingType.REVIEW,
    required: false,
  })
  type?: RatingType;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);
