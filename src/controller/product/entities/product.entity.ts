import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ _id: false })
export class PricingOption {
  @ApiProperty({ example: 1, description: 'Quantity value' })
  @Prop({
    required: true,
    min: [0.00001, 'quantityValue must be greater than 0'],
  })
  quantityValue: number;

  @ApiProperty({
    example: 'kg',
    description: 'Quantity unit (must be kg)',
    default: 'kg',
    enum: ['kg'],
  })
  @Prop({ required: true, default: 'kg', enum: ['kg'], lowercase: true })
  quantityUnit: string;

  @ApiProperty({ example: 150, description: 'Pricing amount' })
  @Prop({
    required: true,
    min: [0, 'amount must be greater than or equal to 0'],
  })
  amount: number;

  @ApiProperty({
    example: 'INR',
    description: 'Currency code (must be INR)',
    default: 'INR',
    enum: ['INR'],
  })
  @Prop({ required: true, default: 'INR', enum: ['INR'], uppercase: true })
  currency: string;
}

export const PricingOptionSchema = SchemaFactory.createForClass(PricingOption);

@Schema({ timestamps: true })
export class Product extends BaseEntity {
  @Prop({ required: true })
  name: string;

  @Prop({ type: [PricingOptionSchema], required: true })
  pricing: PricingOption[];

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], required: true })
  images: string[];

  @Prop({ type: [String], required: false, default: [] })
  categoryList: string[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);
