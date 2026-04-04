import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TaskCategory, TaskPriority, TaskStatus } from '../task.enums';

export type TaskDocument = HydratedDocument<Task>;

@Schema({ timestamps: true })
export class Task extends BaseEntity {
  @Prop({ type: String, required: true, trim: true })
  description: string;

  @Prop({ type: String, required: false, trim: true })
  comment?: string;

  @Prop({ type: String, enum: TaskCategory, required: true })
  category: TaskCategory;

  @Prop({
    type: String,
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Prop({
    type: String,
    enum: TaskStatus,
    default: TaskStatus.OPEN,
  })
  status: TaskStatus;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Outlet',
    required: true,
  })
  outletId: string;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  assigneeIds: string[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: string;

  @Prop({ type: [String], required: false, default: [] })
  imageUrls?: string[];

  @Prop({ type: [String], required: false, default: [] })
  videoUrls?: string[];

  @Prop({ type: Date, required: false, default: null })
  completedAt?: Date | null;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ isDeleted: 1, outletId: 1, status: 1, dueDate: 1 });
TaskSchema.index({ isDeleted: 1, assigneeIds: 1, status: 1, dueDate: 1 });
TaskSchema.index({ isDeleted: 1, category: 1, priority: 1 });
