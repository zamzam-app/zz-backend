import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { TaskEventType } from '../task.enums';

export type TaskEventDocument = HydratedDocument<TaskEvent>;

/**
 * TaskEvent represents a single immutable action on a task.
 *
 * This collection forms the **append-only event log** for the task thread.
 * Events are never updated or deleted — new events are appended to represent
 * state changes. The main Task document is a read-model that is eventually
 * consistent with this event stream via projections.
 *
 * Designed for:
 * - Cursor-based pagination (use `createdAt` or `sortKey` as the cursor)
 * - Expo Go / React Native timeline rendering (flat list with `createdAt` ordering)
 * - Scalable MongoDB querying (compound indexes on taskId + createdAt)
 * - Audit trails and full activity history
 */
@Schema({ timestamps: true })
export class TaskEvent {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true,
  })
  taskId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: TaskEventType,
    required: true,
  })
  type!: TaskEventType;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  data!: Record<string, unknown>;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  version!: number;

  /**
   * Sort key for cursor-based pagination.
   * Uses a combination of timestamp + random suffix to ensure unique ordering
   * when multiple events occur within the same millisecond.
   */
  @Prop({ type: String, required: true })
  sortKey!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TaskEventSchema = SchemaFactory.createForClass(TaskEvent);

// -- Indexes --
TaskEventSchema.index({ taskId: 1, sortKey: -1 });
TaskEventSchema.index({ sortKey: -1 });
TaskEventSchema.index({ type: 1, createdAt: -1 });
TaskEventSchema.index({ createdBy: 1, createdAt: -1 });
TaskEventSchema.index({ taskId: 1, version: 1 }, { unique: true });
