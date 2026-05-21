import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { AttachmentType } from '../task.enums';

export type TaskAttachmentDocument = HydratedDocument<TaskAttachment>;

@Schema({ timestamps: true })
export class TaskAttachment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Task',
    required: true,
  })
  taskId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'TaskEvent',
    required: false,
    default: null,
  })
  eventId?: Types.ObjectId | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  uploadedBy!: Types.ObjectId;

  @Prop({
    type: String,
    enum: AttachmentType,
    required: true,
  })
  type!: AttachmentType;

  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: Number, required: false })
  size?: number;

  @Prop({ type: String, required: false })
  mimeType?: string;

  @Prop({ type: Boolean, default: false })
  isDeleted!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TaskAttachmentSchema =
  SchemaFactory.createForClass(TaskAttachment);

// -- Indexes --
TaskAttachmentSchema.index({ taskId: 1, isDeleted: 1, createdAt: -1 });
TaskAttachmentSchema.index({ taskId: 1, type: 1, isDeleted: 1 });
TaskAttachmentSchema.index({ uploadedBy: 1, isDeleted: 1, createdAt: -1 });
TaskAttachmentSchema.index({ eventId: 1, isDeleted: 1 });
