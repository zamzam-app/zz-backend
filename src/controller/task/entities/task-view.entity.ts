import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TaskViewDocument = HydratedDocument<TaskView>;

@Schema({ timestamps: true })
export class TaskView {
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
  userId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  lastViewedAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TaskViewSchema = SchemaFactory.createForClass(TaskView);

// -- Indexes --
TaskViewSchema.index({ taskId: 1, userId: 1 }, { unique: true });
TaskViewSchema.index({ userId: 1, lastViewedAt: -1 });
TaskViewSchema.index({ lastViewedAt: -1 });
