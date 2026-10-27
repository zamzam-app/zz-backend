import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PendingTaskActivityDocument = HydratedDocument<PendingTaskActivity>;

/**
 * A batched "New Activity" push that has not been sent yet.
 *
 * Comments and attachments on a task are collapsed into one push after a
 * short quiet period. The in-memory timer in `TaskEventService` sends it on
 * time; this record makes sure a restart or deploy in that window delays the
 * push instead of dropping it. Whoever deletes the record sends the push, so
 * several instances never send it twice.
 */
@Schema({ collection: 'pendingtaskactivities', timestamps: true })
export class PendingTaskActivity {
  @Prop({ required: true, unique: true })
  taskId: string;

  /** Number of comment/attachment events in this batch. */
  @Prop({ default: 1 })
  eventCount: number;

  /** Users who performed the events; they are not notified. */
  @Prop({ type: [String], default: [] })
  actorIds: string[];

  /** When the batch is due to be sent (pushed back by each new event). */
  @Prop({ required: true, index: true })
  flushAt: Date;
}

export const PendingTaskActivitySchema =
  SchemaFactory.createForClass(PendingTaskActivity);
