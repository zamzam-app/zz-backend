import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../../../notifications/notifications.service';
import { UsersService } from '../../users/users.service';
import { Task, TaskDocument } from '../entities/task.entity';
import { TaskEvent, TaskEventDocument } from '../entities/task-event.entity';
import {
  TaskDelegation,
  TaskDelegationDocument,
} from '../entities/task-delegation.entity';
import { TaskEventType } from '../task.enums';
import {
  computeProjection,
  computeUnreadIncrementUserIds,
  generateSortKey,
} from './task-event-projection.util';

const NOTIFIABLE_EVENT_TYPES: ReadonlySet<TaskEventType> = new Set([
  TaskEventType.COMMENTED,
  TaskEventType.ATTACHMENT_ADDED,
]);

/** How long to wait before flushing batched notifications for a task. */
const NOTIFICATION_DEBOUNCE_MS = 3_000;

type PendingNotification = {
  /** Node.js timer handle — cleared and reset on each new event. */
  timer: ReturnType<typeof setTimeout>;
  /** Number of notifiable events accumulated in this window. */
  eventCount: number;
  /** Stored taskId to re-fetch the freshest version when the debounce timer fires. */
  taskId: string;
  /** Accumulated actor IDs to exclude from the recipient list. */
  actorIds: Set<string>;
};

export interface AppendEventResult {
  /** The appended event (immutable record). */
  event: TaskEventDocument;
  /** The updated Task read-model after projection. */
  task: TaskDocument;
}

export interface AppendEventOptions {
  /**
   * When `true`, the event is created but the Task version is NOT checked
   * and the read-model is NOT updated.
   *
   * Use this when populating events for a task that was created outside
   * the event system (e.g., legacy backfill).
   */
  skipProjection?: boolean;
}

/**
 * TaskEventService is the **single entry point** for all task mutations.
 *
 * Every state change goes through `appendEvent`, which:
 *  1. Validates the task exists
 *  2. Generates a globally-unique `sortKey`
 *  3. Creates an immutable `TaskEvent` document
 *  4. Computes the projection update (which Task fields change)
 *  5. Computes and applies unreadMap increments
 *  6. Atomically updates the Task read-model with optimistic concurrency
 *
 * **Important:**
 * - Do NOT update the Task document directly outside this service.
 * - Do NOT create events without going through `appendEvent`.
 * - Use `skipProjection` ONLY for backfill/migration scripts.
 */
@Injectable()
export class TaskEventService {
  private readonly logger = new Logger(TaskEventService.name);

  /**
   * In-memory debounce buffer keyed by `taskId`.
   *
   * When multiple notifiable events fire for the same task within
   * `NOTIFICATION_DEBOUNCE_MS`, they are collapsed into a single
   * push notification (e.g. "5 new updates on task '…'").
   */
  private readonly pendingNotifications = new Map<
    string,
    PendingNotification
  >();

  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskEvent.name)
    private readonly taskEventModel: Model<TaskEventDocument>,
    @InjectModel(TaskDelegation.name)
    private readonly taskDelegationModel: Model<TaskDelegationDocument>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Appends an immutable event to the task's event log and updates the
   * Task read-model atomically.
   *
   * @param taskId  - The ID of the task to append the event to.
   * @param type    - The type of event.
   * @param data    - The event payload (type-specific).
   * @param userId  - The ID of the user who performed the action.
   * @param options - Optional flags (e.g., `skipProjection`).
   *
   * @returns The created event and the updated task document.
   *
   * @throws NotFoundException   - If the task does not exist or is deleted.
   * @throws ConflictException   - If another request modified the task first
   *                               (optimistic concurrency conflict).
   */
  async appendEvent(
    taskId: Types.ObjectId | string,
    type: TaskEventType,
    data: Record<string, unknown>,
    userId: Types.ObjectId | string,
    options?: AppendEventOptions,
  ): Promise<AppendEventResult> {
    const taskIdObj = new Types.ObjectId(taskId);
    const actorId = new Types.ObjectId(userId);

    // --------------------------------------------------
    // 1. Read the current task (with version for concurrency)
    // --------------------------------------------------
    const task = await this.taskModel
      .findOne({ _id: taskIdObj, isDeleted: false })
      .exec();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const now = new Date();
    const nextVersion = task.version + 1;

    // --------------------------------------------------
    // 2. Generate sortKey for ordered timeline
    // --------------------------------------------------
    const sortKey = generateSortKey();

    // --------------------------------------------------
    // 3. Create the TaskEvent (append-only, immutable)
    // --------------------------------------------------
    let event: TaskEventDocument;
    try {
      [event] = await this.taskEventModel.create([
        {
          taskId: taskIdObj,
          type,
          data,
          createdBy: actorId,
          version: nextVersion,
          sortKey,
        },
      ]);
    } catch (error: unknown) {
      // E11000 duplicate key error on (taskId, version) unique index
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new ConflictException(
          'Task version conflict: another request already created this event version',
        );
      }
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to create event',
      );
    }

    // --------------------------------------------------
    // 4. Handle skip-projection mode (backfill only)
    // --------------------------------------------------
    if (options?.skipProjection) {
      return { event, task };
    }

    // --------------------------------------------------
    // 5. Compute projection updates
    // --------------------------------------------------
    const projection = computeProjection(type, data, task, actorId, now);

    // --------------------------------------------------
    // 6. Compute unreadMap increments
    // --------------------------------------------------
    const unreadUserIds = computeUnreadIncrementUserIds(task, actorId);
    const unreadIncrements: Record<string, number> = {};
    for (const uid of unreadUserIds) {
      unreadIncrements[`unreadMap.${uid}`] = 1;
    }

    const updateQuery: Record<string, any> = { _id: taskIdObj };
    if (!task.version) {
      updateQuery.$or = [{ version: 0 }, { version: { $exists: false } }];
    } else {
      updateQuery.version = task.version;
    }

    // --------------------------------------------------
    // 7. Atomically update the Task read-model
    // --------------------------------------------------
    const updatedTask = await this.taskModel
      .findOneAndUpdate(
        updateQuery,
        {
          $set: {
            ...projection.$set,
          },
          $inc: {
            version: 1,
            ...projection.$inc,
            ...unreadIncrements,
          },
          ...(Object.keys(projection.$unset).length > 0
            ? { $unset: projection.$unset }
            : {}),
        },
        { new: true },
      )
      .exec();

    if (!updatedTask) {
      // @todo Replace with MongoDB transaction once replica set is available.
      // Version conflict — another request modified the task between our
      // read and write. The event was already created but the Task read-model
      // is now stale. We attempt best-effort cleanup by deleting the event,
      // but in production this should use a transaction or saga pattern.
      try {
        await this.taskEventModel.deleteOne({ _id: event._id }).exec();
      } catch {
        // Best-effort cleanup — log and move on
      }

      throw new ConflictException(
        'Task version conflict: the task was modified by another request. Please retry.',
      );
    }

    // --------------------------------------------------
    // 8. Non-blocking push notification for timeline activity
    //    (debounced per task to avoid notification spam)
    // --------------------------------------------------
    if (NOTIFIABLE_EVENT_TYPES.has(type)) {
      this.scheduleNotification(updatedTask, actorId);
    }

    return { event, task: updatedTask };
  }

  // ------------------------------------------------------------------
  // Push notification helpers (debounced)
  // ------------------------------------------------------------------

  /**
   * Buffers a notifiable event for the given task.
   *
   * If no pending notification exists for this `taskId`, a new debounce
   * timer is started. If one already exists, the timer is reset to
   * `NOTIFICATION_DEBOUNCE_MS` and the event count is incremented.
   *
   * When the timer finally fires, `flushNotification` sends a single
   * push with the accumulated count.
   */
  private scheduleNotification(
    task: TaskDocument,
    actorId: Types.ObjectId,
  ): void {
    const taskId = task._id.toString();
    const existing = this.pendingNotifications.get(taskId);

    if (existing) {
      // Reset the debounce window
      clearTimeout(existing.timer);
      existing.eventCount += 1;
      existing.actorIds.add(actorId.toString());
      existing.timer = setTimeout(
        () => this.flushNotification(taskId),
        NOTIFICATION_DEBOUNCE_MS,
      );
      return;
    }

    const actorIds = new Set<string>([actorId.toString()]);
    const timer = setTimeout(
      () => this.flushNotification(taskId),
      NOTIFICATION_DEBOUNCE_MS,
    );

    this.pendingNotifications.set(taskId, {
      timer,
      eventCount: 1,
      taskId,
      actorIds,
    });
  }

  /**
   * Drains the pending notification for a task and sends a single push.
   *
   * Body varies by count:
   *  - 1 event:  "New activity on task '[description]'."
   *  - N events: "N new updates on task '[description]'."
   */
  private flushNotification(taskId: string): void {
    const pending = this.pendingNotifications.get(taskId);
    if (!pending) {
      return;
    }
    this.pendingNotifications.delete(taskId);

    const { eventCount, taskId: pendingTaskId, actorIds } = pending;

    this.sendBatchedNotification(pendingTaskId, actorIds, eventCount).catch(
      (err) => {
        this.logger.error(
          `Failed to send batched notification for task ${taskId}`,
          err instanceof Error ? err.message : String(err),
        );
      },
    );
  }

  /**
   * Sends a single push notification for batched timeline activity.
   *
   * Audience: union of `createdBy`, `assigneeIds`, `activeOwner`, and
   * `activeDelegation.delegatedTo` — minus all actors who triggered
   * events in the debounce window.
   *
   * This is intentionally fire-and-forget; failures are logged but never
   * propagated to the caller.
   */
  private async sendBatchedNotification(
    taskId: string,
    actorIds: Set<string>,
    eventCount: number,
  ): Promise<void> {
    const task = await this.taskModel
      .findOne({ _id: new Types.ObjectId(taskId), isDeleted: false })
      .exec();

    if (!task) {
      return;
    }

    const recipientIdSet = new Set<string>();

    // Task creator
    if (task.createdBy) {
      recipientIdSet.add(task.createdBy.toString());
    }

    // All assignees
    if (task.assigneeIds?.length) {
      for (const id of task.assigneeIds) {
        recipientIdSet.add(id.toString());
      }
    }

    // Active owner (v2 delegation)
    if (task.activeOwner) {
      recipientIdSet.add(task.activeOwner.toString());
    }

    // Active delegation target (v2 delegation)
    if (task.activeDelegation?.delegatedTo) {
      recipientIdSet.add(task.activeDelegation.delegatedTo.toString());
    }

    // Exclude all actors from the debounce window
    for (const actorId of actorIds) {
      recipientIdSet.delete(actorId);
    }

    if (recipientIdSet.size === 0) {
      return;
    }

    const tokens = await this.usersService.getPushTokensForUsers(
      Array.from(recipientIdSet),
    );

    if (tokens.length === 0) {
      return;
    }

    const body =
      eventCount === 1
        ? `New activity on task '${task.description}'.`
        : `${eventCount} new updates on task '${task.description}'.`;

    try {
      await this.notificationsService.sendPush(tokens, 'New Activity', body, {
        type: 'task',
        taskId: task._id.toString(),
      });

      this.logger.log(
        `Sent batched notification (${eventCount} event(s)) for task ${task._id.toString()} to ${tokens.length} user(s).`,
      );
    } catch (err) {
      this.logger.error('Failed to send push notification', err);
    }
  }

  // ------------------------------------------------------------------
  // Event query helpers
  // ------------------------------------------------------------------

  /**
   * Fetches a paginated list of events for a task, ordered by `sortKey`
   * descending (newest first).
   *
   * Uses cursor-based pagination for stable FlatList rendering.
   */
  async getTaskEvents(
    taskId: Types.ObjectId | string,
    cursor?: string,
    limit: number = 20,
  ): Promise<{
    data: TaskEventDocument[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const taskIdObj = new Types.ObjectId(taskId);
    const query: Record<string, unknown> = { taskId: taskIdObj };

    if (cursor) {
      query.sortKey = { $lt: cursor };
    }

    const events = await this.taskEventModel
      .find(query)
      .sort({ sortKey: -1 })
      .limit(limit + 1)
      .exec();

    const hasMore = events.length > limit;
    const data = events.slice(0, limit);
    const nextCursor = hasMore ? data[data.length - 1].sortKey : null;

    return { data, nextCursor, hasMore };
  }

  /**
   * Returns the total event count for a task.
   */
  async getEventCount(taskId: Types.ObjectId | string): Promise<number> {
    return this.taskEventModel
      .countDocuments({ taskId: new Types.ObjectId(taskId) })
      .exec();
  }

  // ------------------------------------------------------------------
  // Delegation helpers (event-driven)
  // ------------------------------------------------------------------

  /**
   * Records a delegation in the TaskDelegation collection and emits
   * a REASSIGNED event.
   *
   * Delegation details (`delegatedTo`, `delegatedBy`) are passed through
   * the event `data` payload, and the `REASSIGNED` projection in
   * `computeProjection` atomically sets both `activeOwner` and
   * `activeDelegation` on the Task read-model.
   *
   * This ensures the delegation edge record, the event, and the Task
   * read-model are always consistent.
   */
  async delegateTask(
    taskId: Types.ObjectId | string,
    delegatedBy: Types.ObjectId | string,
    delegatedTo: Types.ObjectId | string,
    note?: string,
  ): Promise<AppendEventResult> {
    const taskIdObj = new Types.ObjectId(taskId);
    const fromId = new Types.ObjectId(delegatedBy);
    const toId = new Types.ObjectId(delegatedTo);

    // Append the event FIRST — projection handles both activeOwner and
    // activeDelegation atomically. If appendEvent fails (e.g. version
    // conflict), no delegation edge record is orphaned.
    const result = await this.appendEvent(
      taskIdObj,
      TaskEventType.REASSIGNED,
      {
        from: fromId.toString(),
        to: toId.toString(),
        delegatedBy: fromId.toString(),
        delegatedTo: toId.toString(),
        note: note ?? null,
      },
      fromId,
    );

    // THEN create the delegation edge record. If this fails, the event
    // still exists with delegation data — the record can be recreated
    // from the event log.
    try {
      await this.taskDelegationModel.create({
        taskId: taskIdObj,
        delegatedBy: fromId,
        delegatedTo: toId,
        note: note ?? null,
      });
    } catch {
      // Best-effort: the event already captures the delegation intent.
      // The edge record can be backfilled from the event log if needed.
    }

    return result;
  }

  /**
   * Revokes the current delegation (clears activeDelegation).
   *
   * Passes `revokeDelegation: true` through the event data,
   * which the `REASSIGNED` projection uses to `$unset` the
   * `activeDelegation` sub-document atomically.
   */
  async revokeDelegation(
    taskId: Types.ObjectId | string,
    revokedBy: Types.ObjectId | string,
  ): Promise<AppendEventResult> {
    const taskIdObj = new Types.ObjectId(taskId);
    const actorId = new Types.ObjectId(revokedBy);

    // Delegate to appendEvent — the REASSIGNED projection in
    // computeProjection handles:
    //   - Unsetting activeDelegation
    //   - Restoring activeOwner to the original delegator or task creator
    // All atomically via the read model update.
    return this.appendEvent(
      taskIdObj,
      TaskEventType.REASSIGNED,
      {
        revokeDelegation: true,
        reason: 'Delegation revoked',
      },
      actorId,
    );
  }
}
