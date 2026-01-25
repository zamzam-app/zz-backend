import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type ProductDocument = HydratedDocument<Product>;

export enum ProductType {
  PREMADE = 'premade',
  CUSTOM = 'custom',
}

@Schema({ timestamps: true })
export class Product extends BaseEntity {
  @ApiProperty({ example: 'Wireless Headphones', description: 'Product name' })
  @Prop({ required: true })
  name: string;

  @ApiProperty({ example: 99.99, description: 'Product price' })
  @Prop({ required: true })
  price: number;

  @ApiProperty({
    example: 'High-quality wireless headphones with noise cancellation.',
    description: 'Product description',
  })
  @Prop({ required: true })
  description: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated ratings ID',
    required: false,
  })
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  ratingsId?: string;

  @ApiProperty({
    example: ['image1.jpg', 'image2.jpg'],
    description: 'Array of product image URLs',
  })
  @Prop({ type: [String], required: true })
  images: string[];

  @ApiProperty({
    example: 'premade',
    enum: ProductType,
    description: 'Type of product',
  })
  @Prop({ type: String, enum: ProductType, required: true })
  type: ProductType;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
