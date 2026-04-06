import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type UploadedCakeDocument = HydratedDocument<UploadedCake>;

@Schema({ timestamps: true })
export class UploadedCake extends BaseEntity {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, trim: true })
  phone: string;

  @Prop({ type: String, required: true, trim: true })
  referenceImageUrl: string;

  @Prop({ type: String, required: true, trim: true })
  description: string;
}

export const UploadedCakeSchema = SchemaFactory.createForClass(UploadedCake);
UploadedCakeSchema.index({ isDeleted: 1, createdAt: -1 });
UploadedCakeSchema.index({ isDeleted: 1, userId: 1, createdAt: -1 });
