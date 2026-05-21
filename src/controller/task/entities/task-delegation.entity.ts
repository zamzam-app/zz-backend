import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TaskDelegationDocument = HydratedDocument<TaskDelegation>;

@Schema({ timestamps: true })
export class TaskDelegation {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Task',
    required: true,
  })
  taskId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  delegatedBy!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  delegatedTo!: Types.ObjectId;

  @Prop({ type: String, trim: true, default: null })
  note?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TaskDelegationSchema =
  SchemaFactory.createForClass(TaskDelegation);

// -- Indexes --
TaskDelegationSchema.index({ taskId: 1, createdAt: -1 });
TaskDelegationSchema.index({ delegatedTo: 1, createdAt: -1 });
TaskDelegationSchema.index({ delegatedBy: 1, createdAt: -1 });
