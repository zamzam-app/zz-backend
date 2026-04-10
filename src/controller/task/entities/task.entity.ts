import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TaskPriority, TaskStatus } from '../task.enums';

export type TaskDocument = HydratedDocument<Task>;

@Schema({ _id: false })
export class TaskAttachments {
  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ type: [String], default: [] })
  videos!: string[];

  @Prop({ type: [String], default: [] })
  audios!: string[];

  @Prop({ type: [String], default: [] })
  files!: string[];
}

@Schema({ _id: false })
export class TaskSubmission {
  @Prop({ type: String, trim: true })
  text?: string;

  @Prop({ type: TaskAttachments, default: () => ({}) })
  attachments!: TaskAttachments;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy!: string;

  @Prop({ type: Date, default: Date.now })
  createdAt!: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt!: Date;
}

@Schema({ timestamps: true })
export class Task extends BaseEntity {
  @Prop({ type: String, required: true, trim: true })
  description!: string;

  @Prop({ type: String, required: false, trim: true })
  comment?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'TaskCategory',
    required: true,
  })
  taskCategoryId!: string;

  @Prop({
    type: String,
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  priority!: TaskPriority;

  @Prop({
    type: String,
    enum: TaskStatus,
    default: TaskStatus.OPEN,
  })
  status!: TaskStatus;

  @Prop({ type: Date, required: true })
  dueDate!: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Outlet',
    required: false,
    default: null,
  })
  outletId!: string;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  assigneeIds!: string[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy!: string;

  @Prop({ type: [String], required: false, default: [] })
  imageUrls?: string[];

  @Prop({ type: [String], required: false, default: [] })
  videoUrls?: string[];

  @Prop({ type: [String], required: false, default: [] })
  adminAudioUrl?: string[];

  @Prop({ type: [String], required: false, default: [] })
  managerAudioUrl?: string[];

  @Prop({ type: String, required: false, trim: true, default: '' })
  managerComments?: string;

  @Prop({ type: Date, required: false, default: null })
  completedAt?: Date | null;

  @Prop({ type: TaskSubmission, required: false })
  adminSubmission?: TaskSubmission;

  @Prop({ type: TaskSubmission, required: false })
  managerSubmission?: TaskSubmission;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ isDeleted: 1, outletId: 1, status: 1, dueDate: 1 });
TaskSchema.index({ isDeleted: 1, assigneeIds: 1, status: 1, dueDate: 1 });
TaskSchema.index({ isDeleted: 1, taskCategoryId: 1, priority: 1 });
