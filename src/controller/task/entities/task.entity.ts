import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TaskPriority, TaskStatus, TaskRecurrenceType } from '../task.enums';

export type TaskDocument = HydratedDocument<Task>;

@Schema({ _id: false })
export class TaskReminderNotifications {
  @Prop({ type: Date, default: null })
  oneHourSentAt?: Date | null;

  @Prop({ type: Date, default: null })
  thirtyMinutesSentAt?: Date | null;
}

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
    type: String,
    required: true,
    trim: true,
    match: /^([01]\d|2[0-3]):([0-5]\d)$/,
  })
  dueTime!: string;

  @Prop({ type: Boolean, default: false })
  isRecurring!: boolean;

  @Prop({
    type: String,
    enum: TaskRecurrenceType,
    required: false,
  })
  recurrenceType?: TaskRecurrenceType;

  @Prop({
    type: [Number],
    required: false,
  })
  recurrenceDays?: number[];

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

  @Prop({ type: Date, required: false, default: null })
  completedAt?: Date | null;

  @Prop({ type: TaskSubmission, required: false })
  adminSubmission?: TaskSubmission;

  @Prop({ type: TaskSubmission, required: false })
  managerSubmission?: TaskSubmission;

  @Prop({ type: TaskReminderNotifications, default: () => ({}) })
  reminderNotifications?: TaskReminderNotifications;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ isDeleted: 1, outletId: 1, status: 1, dueDate: 1 });
TaskSchema.index({ isDeleted: 1, assigneeIds: 1, status: 1, dueDate: 1 });
TaskSchema.index({ isDeleted: 1, taskCategoryId: 1, priority: 1 });
