import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type CustomCakeDocument = HydratedDocument<CustomCake>;

@Schema({ timestamps: true })
export class CustomCake extends BaseEntity {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: string;

  @Prop({ type: String, required: true, trim: true })
  prompt: string;

  @Prop({ type: String, required: true, trim: true })
  imageUrl: string;
}

export const CustomCakeSchema = SchemaFactory.createForClass(CustomCake);
CustomCakeSchema.index({ isDeleted: 1, userId: 1, createdAt: -1 });
