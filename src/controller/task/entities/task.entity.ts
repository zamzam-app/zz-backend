import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  TaskPriority,
  TaskStatus,
  TaskRecurrenceType,
  TaskEventType,
} from '../task.enums';

export type TaskDocument = HydratedDocument<Task>;

// To avoid duplicate push notifications when cron job runs.
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

// ---------------------------------------------------------------------------
// Thread summary sub-document (denormalized read-model fields)
// ---------------------------------------------------------------------------

@Schema({ _id: false })
export class TaskThreadStats {
  @Prop({ type: Number, default: 0, min: 0 })
  eventCount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  attachmentCount!: number;

  @Prop({ type: Date, default: null })
  lastEventAt?: Date | null;
}

@Schema({ _id: false })
export class TaskLastEvent {
  @Prop({ type: String, enum: TaskEventType, required: true })
  type!: TaskEventType;

  @Prop({ type: String, trim: true, default: '' })
  description?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  by!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  at!: Date;
}

@Schema({ _id: false })
export class TaskActiveDelegation {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  delegatedTo!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  delegatedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  delegatedAt!: Date;
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
  taskCategoryId!: Types.ObjectId;

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
  outletId!: Types.ObjectId | null;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  assigneeIds!: Types.ObjectId[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy!: Types.ObjectId;

  @Prop({ type: Date, required: false, default: null })
  completedAt?: Date | null;

  // -- v1 submission fields (kept for backward compat; migrated to events over time) --

  @Prop({ type: TaskSubmission, required: false })
  adminSubmission?: TaskSubmission;

  @Prop({ type: TaskSubmission, required: false })
  managerSubmission?: TaskSubmission;

  @Prop({ type: TaskReminderNotifications, default: () => ({}) })
  reminderNotifications?: TaskReminderNotifications;

  // --------------------------------------------------
  // v2 — Thread / Event-based fields
  // --------------------------------------------------

  /** The current "owner" (the user primarily responsible for this task). */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null,
  })
  activeOwner?: Types.ObjectId | null;

  /** Active delegation information (null when not delegated). */
  @Prop({ type: TaskActiveDelegation, required: false, default: null })
  activeDelegation?: TaskActiveDelegation | null;

  /** Denormalized thread statistics updated by event projections. */
  @Prop({ type: TaskThreadStats, default: () => ({}) })
  threadStats!: TaskThreadStats;

  /** Snapshot of the most recent event (used for timeline previews). */
  @Prop({ type: TaskLastEvent, required: false })
  lastEvent?: TaskLastEvent;

  /**
   * Optimistic concurrency version.
   * Incremented on every event write to prevent stale updates.
   * Clients should read the version before mutating and pass it back.
   */
  @Prop({ type: Number, default: 0, min: 0 })
  version!: number;

  /**
   * Per-user unread event count.
   * Key: User ObjectId as string, Value: number of unseen events.
   * Cleared when a user creates a TaskView record for this task.
   */
  @Prop({ type: Map, of: Number, default: new Map() })
  unreadMap!: Map<string, number>;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// -- Indexes --
// v1 indexes (preserved)
TaskSchema.index({ isDeleted: 1, outletId: 1, status: 1, dueDate: 1 });
TaskSchema.index({ isDeleted: 1, assigneeIds: 1, status: 1, dueDate: 1 });
TaskSchema.index({ isDeleted: 1, taskCategoryId: 1, priority: 1 });

// v2 indexes
TaskSchema.index({ isDeleted: 1, activeOwner: 1, status: 1 });
TaskSchema.index({
  isDeleted: 1,
  'activeDelegation.delegatedTo': 1,
  status: 1,
});
TaskSchema.index({ isDeleted: 1, 'threadStats.lastEventAt': -1 });
TaskSchema.index({ version: 1 });
