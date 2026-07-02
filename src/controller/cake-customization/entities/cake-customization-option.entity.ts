import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum CakeCustomizationType {
  SHAPE = 'shape',
  FLAVOR = 'flavor',
  DECORATION = 'decoration',
}

export type CakeCustomizationOptionDocument =
  HydratedDocument<CakeCustomizationOption>;

@Schema({ timestamps: true })
export class CakeCustomizationOption extends BaseEntity {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, default: 'INR' })
  currency: string;

  @Prop({ required: true, enum: CakeCustomizationType })
  type: CakeCustomizationType;
}

export const CakeCustomizationOptionSchema = SchemaFactory.createForClass(
  CakeCustomizationOption,
);

CakeCustomizationOptionSchema.index({ isDeleted: 1, type: 1 });
