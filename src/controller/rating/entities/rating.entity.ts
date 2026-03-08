import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Schema as MongooseSchema,
  type ObjectId,
} from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type RatingDocument = HydratedDocument<Rating>;

export enum ComplaintStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

// User response schema for rating
@Schema()
export class UserResponse {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: 'Question',
  })
  questionId: ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  answer: string | string[] | number;
}

export const UserResponseSchema = SchemaFactory.createForClass(UserResponse);

// Rating schema
@Schema({ timestamps: true })
export class Rating extends BaseEntity {
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

  @Prop({ required: true, type: [UserResponseSchema] })
  userResponses: UserResponse[];

  @Prop({ required: true, type: Number, max: 5, min: 1 })
  overallRating: number;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Form',
    required: false,
    default: null,
  })
  formId?: ObjectId;

  @Prop({ required: false, default: false })
  isComplaint?: boolean;

  @Prop({
    required: false,
    enum: ComplaintStatus,
    default: ComplaintStatus.PENDING,
  })
  complaintStatus?: ComplaintStatus;

  @Prop({ required: false })
  complaintReason?: string;

  @Prop({ required: false })
  resolvedAt?: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null,
  })
  resolvedBy?: ObjectId;

  @Prop({ required: false })
  resolutionNotes?: string;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);
