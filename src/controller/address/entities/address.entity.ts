import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type AddressDocument = HydratedDocument<Address>;

@Schema({ timestamps: true })
export class Address extends BaseEntity {
  @Prop({ required: true })
  street: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  pincode: string;

  @Prop({ required: true })
  district: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: false })
  mapLink?: string;

  @Prop({ required: false })
  phoneNumber?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  outletId?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  userId?: string;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
