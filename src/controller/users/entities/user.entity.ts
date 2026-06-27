import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserRole } from '../interfaces/user.interface';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class UserPushToken {
  @Prop({ required: true, type: String })
  token: string;

  @Prop({
    required: false,
    type: String,
    enum: ['ios', 'android', 'unknown'],
    default: 'unknown',
  })
  platform: 'ios' | 'android' | 'unknown';

  @Prop({ required: false, type: String })
  deviceId?: string;

  @Prop({ required: false, type: String })
  appVersion?: string;

  @Prop({ required: true, type: Date, default: () => new Date() })
  lastSeenAt: Date;

  @Prop({ required: true, type: Date, default: () => new Date() })
  createdAt: Date;
}

export const UserPushTokenSchema = SchemaFactory.createForClass(UserPushToken);

@Schema({ timestamps: true })
export class User extends BaseEntity {
  @Prop({ required: false })
  name: string;

  @Prop({
    required: true,
    enum: UserRole,
    default: UserRole.USER,
    type: String,
  })
  role: UserRole;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Address',
    required: false,
  })
  addressId?: string;

  // Admin and Manager specific fields
  @Prop({ required: false, unique: true, sparse: true })
  email?: string;

  @Prop({ required: false, select: false })
  password?: string;

  @Prop({ required: false, unique: true, sparse: true })
  userName?: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId }], required: false })
  outlets?: string[];

  // User specific fields
  @Prop({ required: false, unique: true, sparse: true })
  phoneNumber?: string;

  @Prop({ type: String, default: null })
  pushToken?: string;

  @Prop({ type: [UserPushTokenSchema], default: [] })
  pushTokens?: UserPushToken[];

  @Prop({ required: false, select: false })
  otp?: string;

  @Prop({ required: false, type: String, default: 'male' })
  gender?: string;

  @Prop({ required: false, type: Date, default: null })
  dob?: Date;

  @Prop({ required: false, type: Date, default: null })
  lastLoginAt?: Date;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Review' }],
    required: false,
    default: [],
  })
  userReviews?: string[];

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'CustomCake' }],
    required: false,
    default: [],
  })
  custom_cakes?: string[];

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'UploadedCake' }],
    required: false,
    default: [],
  })
  uploaded_cakes?: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ isDeleted: 1, role: 1 });
UserSchema.index({ 'pushTokens.token': 1 }, { sparse: true });
