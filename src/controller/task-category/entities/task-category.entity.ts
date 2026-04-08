import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type TaskCategoryDocument = HydratedDocument<TaskCategory>;

@Schema({ timestamps: true })
export class TaskCategory extends BaseEntity {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: false, trim: true })
  description?: string;
}

export const TaskCategorySchema = SchemaFactory.createForClass(TaskCategory);

TaskCategorySchema.index({ isDeleted: 1, name: 1 });
