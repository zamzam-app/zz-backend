import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PushReceiptDocument = HydratedDocument<PushReceipt>;

/**
 * Expo returns a ticket ID for every accepted push. The real delivery result
 * (DeviceNotRegistered, InvalidCredentials, ...) is only available later as a
 * receipt, so we keep the ticket ID and the target token until it is checked.
 * Expo discards receipts after 24h, so the record expires with it.
 */
@Schema({ collection: 'pushreceipts', timestamps: { updatedAt: false } })
export class PushReceipt {
  @Prop({ required: true, unique: true })
  ticketId: string;

  @Prop({ required: true })
  token: string;

  createdAt?: Date;
}

export const PushReceiptSchema = SchemaFactory.createForClass(PushReceipt);

PushReceiptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
