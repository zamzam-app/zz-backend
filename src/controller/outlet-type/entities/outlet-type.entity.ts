import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type OutletTypeDocument = HydratedDocument<OutletType>;

@Schema({ timestamps: true })
export class OutletType extends BaseEntity {
  @ApiProperty({
    example: 'Restaurant',
    description: 'Name of the outlet type',
  })
  @Prop({ required: true })
  name: string;

  @ApiProperty({
    example: 'A place where people can eat and dine',
    description: 'Description of the outlet type',
  })
  @Prop({ required: true })
  description: string;

  @ApiProperty({
    example: ['60d5ecb86217152c9043e02d'],
    description: 'Array of menu object IDs',
    type: [String],
  })
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Outlet' }] })
  menu: string[];

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated form ID',
    required: false,
  })
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  formId?: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Default manager user ID',
    required: false,
  })
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  defaultManager?: string;
}

export const OutletTypeSchema = SchemaFactory.createForClass(OutletType);
