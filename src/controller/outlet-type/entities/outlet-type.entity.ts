import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type OutletTypeDocument = HydratedDocument<OutletType>;

@Schema({ timestamps: true })
export class OutletType extends BaseEntity {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Outlet' }] })
  menu: string[];

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  formId?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  defaultManager?: string;
}

export const OutletTypeSchema = SchemaFactory.createForClass(OutletType);
