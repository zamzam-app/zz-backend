import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type AddressDocument = HydratedDocument<Address>;

@Schema({ timestamps: true })
export class Address extends BaseEntity {
  @ApiProperty({ example: '123 Main St', description: 'Street address' })
  @Prop({ required: true })
  street: string;

  @ApiProperty({ example: 'Springfield', description: 'City name' })
  @Prop({ required: true })
  city: string;

  @ApiProperty({ example: '627001', description: 'Pincode/Zip code' })
  @Prop({ required: true })
  pincode: string;

  @ApiProperty({ example: 'Tirunelveli', description: 'District name' })
  @Prop({ required: true })
  district: string;

  @ApiProperty({ example: 'Tamil Nadu', description: 'State name' })
  @Prop({ required: true })
  state: string;

  @ApiProperty({ example: 'India', description: 'Country name' })
  @Prop({ required: true })
  country: string;

  @ApiProperty({
    example: 'https://maps.google.com/?q=...',
    description: 'Google Maps link',
    required: false,
  })
  @Prop({ required: false })
  mapLink?: string;

  @ApiProperty({
    example: '+919876543210',
    description: 'Contact phone number',
    required: false,
  })
  @Prop({ required: false })
  phoneNumber?: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated outlet ID',
    required: false,
  })
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  outletId?: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated user ID',
    required: false,
  })
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  userId?: string;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
