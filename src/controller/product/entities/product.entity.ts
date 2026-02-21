import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type ProductDocument = HydratedDocument<Product>;

export enum ProductType {
  PREMADE = 'premade',
  CUSTOM = 'custom',
}

@Schema({ timestamps: true })
export class Product extends BaseEntity {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  description: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  ratingsId?: string;

  @Prop({ type: [String], required: true })
  images: string[];

  @Prop({ type: String, enum: ProductType, required: true })
  type: ProductType;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
