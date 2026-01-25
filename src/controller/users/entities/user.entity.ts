import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MANAGER = 'manager',
}

@Schema({ timestamps: true })
export class User {
  @ApiProperty({
    example: 'johndoe',
    description: 'The unique username of the user',
  })
  @Prop({ required: false })
  userName: string;

  @ApiProperty({
    example: 'user',
    enum: UserRole,
    description: 'The role of the user',
  })
  @Prop({ required: true, enum: UserRole, default: UserRole.USER })
  userRole: string;

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
}

export const UserSchema = SchemaFactory.createForClass(User);
