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

export enum ComplaintStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Schema()
export class UserResponse {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: 'Question',
  })
  questionId: ObjectId;

  @Prop({ type: [String], required: true })
  answer: string | string[] | number;

  @Prop({ required: false, default: false })
  isComplaint?: boolean;

  @Prop({
    required: false,
    enum: ComplaintStatus,
    default: ComplaintStatus.PENDING,
  })
  complaintStatus?: ComplaintStatus;

  @Prop({ required: false })
  resolvedAt?: Date;

  @Prop({ required: false })
  resolutionNotes?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null,
  })
  resolutionBy?: ObjectId;
}

export const UserResponseSchema = SchemaFactory.createForClass(UserResponse);

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

  // Might use later for other types of ratings
  @Prop({
    type: String,
    enum: RatingType,
    default: RatingType.REVIEW,
    required: false,
  })
  type?: RatingType;

  // Not used as we can get from outlet
  @Prop({
    type: String,
    ref: 'Form',
    required: false,
    default: null,
  })
  formId?: string;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);
