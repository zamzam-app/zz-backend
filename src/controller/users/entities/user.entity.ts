import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
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
  @Prop({ required: false })
  name: string;

  @Prop({ required: false, unique: true, sparse: true })
  userName?: string;

  @Prop({ required: true, enum: UserRole, default: UserRole.USER })
  role: string;

  @Prop({ required: false, select: false })
  password?: string;

  @Prop({ required: false })
  phoneNumber?: string;

  @Prop({ required: false })
  email?: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId }], required: false })
  outlets?: string[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Address',
    required: false,
  })
  addressId?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
