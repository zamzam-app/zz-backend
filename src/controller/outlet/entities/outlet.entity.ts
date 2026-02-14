import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type OutletDocument = HydratedDocument<Outlet>;

@Schema({ timestamps: true })
export class Outlet extends BaseEntity {
  @ApiProperty({ example: 'Downtown Bistro', description: 'Outlet name' })
  @Prop({ required: true })
  name: string;

  @ApiProperty({
    example: 'A cozy bistro in the city center.',
    description: 'Outlet description',
  })
  @Prop({ required: true })
  description: string;

  @ApiProperty({
    example: ['image1.jpg', 'image2.jpg'],
    description: 'Array of outlet image URLs',
  })
  @Prop({ type: [String], required: true })
  images: string[];

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated address ID',
    required: false,
  })
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Address',
    required: false,
  })
  addressId?: string;

  @ApiProperty({
    example: '123 Main St, City, Country',
    description: 'Outlet address string',
    required: false,
  })
  @Prop({ required: false })
  address?: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated manager ID',
  })
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    nullable: true,
  })
  managerId: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated form ID',
  })
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  formId?: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated product template ID',
  })
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  productTemplateId?: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated outlet type ID',
  })
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'OutletType',
    required: true,
  })
  type: string;
}

export const OutletSchema = SchemaFactory.createForClass(Outlet);
