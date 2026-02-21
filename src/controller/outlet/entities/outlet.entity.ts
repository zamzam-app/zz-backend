import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type OutletDocument = HydratedDocument<Outlet>;

@Schema({ timestamps: true })
export class Outlet extends BaseEntity {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'OutletType',
    required: true,
  })
  outletType: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], required: true })
  images: string[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null,
  })
  managerId: string;

  // This can be used to store form for the outlet.
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false, default: null })
  formId: string;

  @Prop({ required: true, unique: true })
  qrToken: string;

  // This can be used to store address in address collection.
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Address',
    required: false,
  })
  addressId?: string;

  // This can be used to store address in outlet collection.
  @Prop({ required: false })
  address?: string;

  // This can be used to store menu (product template) for the outlet.
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  productTemplateId?: string;
}

export const OutletSchema = SchemaFactory.createForClass(Outlet);
