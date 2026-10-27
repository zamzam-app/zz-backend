import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PendingComplaintDocument = HydratedDocument<PendingComplaint>;

@Schema({ collection: 'pendingcomplaints', timestamps: true })
export class PendingComplaint {
  @Prop({ required: true, unique: true })
  outletId: string;

  @Prop({ required: true })
  outletName: string;

  // User IDs (not device tokens): tokens are resolved when the batch is sent,
  // so users who logged in/out during the debounce window are handled correctly.
  @Prop({ type: [String], required: true })
  userIds: string[];

  @Prop({ default: 1 })
  eventCount: number;

  @Prop({ required: true })
  reviewId: string;
}

export const PendingComplaintSchema =
  SchemaFactory.createForClass(PendingComplaint);
