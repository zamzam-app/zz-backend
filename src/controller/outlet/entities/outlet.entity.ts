import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type OutletDocument = HydratedDocument<Outlet>;

@Schema({ _id: false })
export class OutletMenuItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId: string;

  @Prop({ required: true, default: true })
  isAvailable: boolean;
}

export const OutletMenuItemSchema =
  SchemaFactory.createForClass(OutletMenuItem);

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

  // This can be used to store QR token for the outlet.
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

  // This can be used to store menu items for the outlet.
  @Prop({ type: [OutletMenuItemSchema], required: false, default: [] })
  menuItems?: OutletMenuItem[];

  // This can be used to store menu (product template) for the outlet. Will implement this later.
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  productTemplateId?: string;

  // Google Maps Link
  @Prop({ required: false })
  googleMapsLink?: string;

  // Stores references to outlet tables in the OutletTable collection.
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'OutletTable' }],
    required: false,
    default: [],
  })
  tableIds?: string[];
}

export const OutletSchema = SchemaFactory.createForClass(Outlet);
OutletSchema.index({ isDeleted: 1, outletType: 1 });
