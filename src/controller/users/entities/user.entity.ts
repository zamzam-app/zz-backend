import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MANAGER = 'manager',
}

@Schema({ timestamps: true })
export class User extends BaseEntity {
  @ApiProperty({
    example: 'johndoe',
    description: 'The unique name of the user',
  })
  @Prop({ required: false })
  name: string;

  @ApiProperty({
    example: 'john_doe_99',
    description: 'The username of the user',
    required: false,
  })
  @Prop({ required: false, unique: true, sparse: true })
  userName?: string;

  @ApiProperty({
    example: 'user',
    enum: UserRole,
    description: 'The role of the user',
  })
  @Prop({ required: true, enum: UserRole, default: UserRole.USER })
  role: string;

  @ApiProperty({
    example: 'password123',
    description: 'The password of the user',
    required: false,
  })
  @Prop({ required: false })
  password?: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'The phone number of the user',
    required: false,
  })
  @Prop({ required: false })
  phoneNumber?: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'The email of the user',
    required: false,
  })
  @Prop({ required: false })
  email?: string;

  @ApiProperty({
    example: ['60d5ecb86217152c9043e02d'],
    description: 'Array of outlet IDs associated with the user',
    required: false,
  })
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId }], required: false })
  outlets?: string[];

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
}

export const UserSchema = SchemaFactory.createForClass(User);
