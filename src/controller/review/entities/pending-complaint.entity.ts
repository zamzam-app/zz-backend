import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PendingComplaintDocument = HydratedDocument<PendingComplaint>;

@Schema({ collection: 'pendingcomplaints', timestamps: true })
export class PendingComplaint {
  @Prop({ required: true, unique: true })
  outletId: string;

  @Prop({ required: true })
  outletName: string;

  @Prop({ type: [String], required: true })
  tokens: string[];

  @Prop({ default: 1 })
  eventCount: number;

  @Prop({ required: true })
  reviewId: string;
}

export const PendingComplaintSchema =
  SchemaFactory.createForClass(PendingComplaint);
