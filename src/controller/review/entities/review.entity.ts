import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type ReviewDocument = HydratedDocument<Review>;

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
  questionId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  answer: string | string[] | number;
}

export const UserResponseSchema = SchemaFactory.createForClass(UserResponse);

@Schema({ timestamps: true })
export class Review extends BaseEntity {
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

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'OutletTable',
    required: false,
    default: null,
  })
  outletTableId?: Types.ObjectId | null;

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
  formId?: string;

  @Prop({ required: false, default: false })
  isComplaint?: boolean;

  @Prop({
    required: false,
    enum: ComplaintStatus,
    default: ComplaintStatus.PENDING,
  })
  complaintStatus?: ComplaintStatus;

  @Prop({ type: String, required: false, default: null })
  complaintReason?: string | null;

  @Prop({ type: Date, required: false, default: null })
  resolvedAt?: Date | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null,
  })
  resolvedBy?: Types.ObjectId | null;

  @Prop({ type: String, required: false, default: null })
  resolutionNotes?: string | null;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
