import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from '../entities/task.entity';
import { TaskView, TaskViewDocument } from '../entities/task-view.entity';
import { User, UserDocument } from '../../users/entities/user.entity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Lightweight unread count payload for a single task.
 * Used for badge rendering on task list items.
 */
export interface TaskUnreadCount {
  taskId: string;
  unreadCount: number;
}

/**
 * Aggregated unread summary across all tasks for a user.
 */
export interface AggregatedUnreadSummary {
  /** Total unread events across all tasks. */
  totalUnread: number;
  /** Number of tasks that have at least one unread event. */
  taskCount: number;
}

/**
 * Recently viewed task payload (mobile-optimized).
 * Includes a minimal subset of fields for rendering a task card.
 */
export interface RecentlyViewedTaskItem {
  /** When the user last viewed this task. */
  lastViewedAt: string;
  /** Task summary snapshot (from the Task read-model). */
  task: {
    _id: string;
    description: string;
    status: string;
    priority: string;
    dueDate: string;
    dueTime: string;
    unreadCount: number;
  };
}

/**
 * Cursor for recently viewed pagination.
 * Encoded as base64 JSON for API transport.
 */
export interface RecentlyViewedCursor {
  lastViewedAt: string;
}

// ---------------------------------------------------------------------------
// Cursor helpers (local to this service)
// ---------------------------------------------------------------------------

function encodeRecentlyViewedCursor(cursor: RecentlyViewedCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf-8').toString('base64');
}

function decodeRecentlyViewedCursor(
  encoded: string | undefined | null,
): RecentlyViewedCursor | null {
  if (!encoded) return null;
  try {
    const raw = Buffer.from(encoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(raw) as RecentlyViewedCursor;
    if (!parsed.lastViewedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * TaskViewService manages per-user task read state and unread tracking.
 *
 * ## UnreadMap Lifecycle
 *
 * 1. **Increment** — When a TaskEvent is appended via `TaskEventService.appendEvent`,
 *    the projection utility `computeUnreadIncrementUserIds` determines which users
 *    should see the new event as "unread" (everyone except the actor). The service
 *    then atomically `$inc`s `unreadMap.<userId>` for each affected user.
 *
 * 2. **Reset** — When the user opens a task (calls `markTaskViewed`), this service:
 *    - Upserts a `TaskView` record with `lastViewedAt = now`
 *    - Atomically `$unset`s `unreadMap.<userId>` on the Task document
 *      (removing the key entirely, keeping the document lean)
 *
 * 3. **Query** — `getUnreadCount()` reads tasks where `unreadMap.<userId>` exists
 *    and is > 0, returning per-task counts for badge rendering.
 *
 * ## Synchronization Strategy
 *
 * - **No distributed locks**: unreadMap updates are atomic MongoDB operations
 *   (`$inc` on write, `$unset` on read). Since only the event service writes
 *   and only the view service resets, conflicts are rare.
 * - **Best-effort consistency**: If a user views a task while an event is being
 *   written, the unread count may temporarily be 1. The next view resets it.
 *   This is acceptable for badge display — stale badges correct themselves
 *   on the next poll or view action.
 *
 * ## Scalability Considerations
 *
 * - `unreadMap` is stored as a MongoDB Map field on the Task document.
 *   For a single user, this is O(1) to read/write. For a task with N users,
 *   the document grows by N map entries. In practice, most tasks have < 10
 *   relevant users (assignees + owner + delegates + creator).
 * - For very large teams (>100 users per task), consider moving unread state
 *   to a separate collection (one document per user-task pair). The current
 *   design optimizes for the common case of 2-10 users per task.
 * - `getUnreadCount()` uses a sparse index on `unreadMap.<userId>` to efficiently
 *   find only the tasks where the user has unread events.
 * - `getRecentlyViewedTasks()` is backed by the existing
 *   `(userId, lastViewedAt: -1)` index on the TaskView collection.
 */
@Injectable()
export class TaskViewService {
  constructor(
    @InjectModel(TaskView.name)
    private readonly taskViewModel: Model<TaskViewDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // -----------------------------------------------------------------------
  // Mark task as viewed
  // -----------------------------------------------------------------------

  /**
   * Marks a task as viewed by a user.
   *
   * This is the primary "acknowledge unread" operation. It performs two
   * atomic writes:
   *  1. Upserts a `TaskView` record (creates or updates `lastViewedAt`)
   *  2. Removes the user's entry from the Task's `unreadMap`
   *
   * If the task does not exist or is deleted, throws `NotFoundException`.
   *
   * The operation is **idempotent** — calling it multiple times with the
   * same (taskId, userId) pair has the same net effect as one call.
   *
   * @param taskId - The task ObjectId.
   * @param userId - The user ObjectId viewing the task.
   *
   * @throws NotFoundException if the task does not exist or is deleted.
   */
  async markTaskViewed(
    taskId: Types.ObjectId | string,
    userId: Types.ObjectId | string,
  ): Promise<void> {
    const taskIdObj = new Types.ObjectId(taskId);
    const userIdObj = new Types.ObjectId(userId);

    // 1. Verify task exists
    const taskExists = await this.taskModel
      .exists({ _id: taskIdObj, isDeleted: false })
      .exec();

    if (!taskExists) {
      throw new NotFoundException('Task not found');
    }

    // 2. Upsert TaskView record (create or update lastViewedAt)
    await this.taskViewModel
      .updateOne(
        { taskId: taskIdObj, userId: userIdObj },
        {
          $set: { lastViewedAt: new Date() },
          $setOnInsert: {
            taskId: taskIdObj,
            userId: userIdObj,
          },
        },
        { upsert: true },
      )
      .exec();

    // 3. Reset unread count for this user on the Task document.
    //    Using $unset removes the key entirely, keeping the document lean.
    // @todo Consider wrapping (2) and (3) in a MongoDB transaction once a
    //       replica set is available.
    await this.taskModel
      .updateOne(
        { _id: taskIdObj },
        { $unset: { [`unreadMap.${userIdObj.toString()}`]: '' } },
      )
      .exec();
  }

  /**
   * Marks multiple tasks as viewed by a user in a single operation.
   *
   * More efficient than calling `markTaskViewed` in a loop when the user
   * has opened a list view (e.g., "Mark all as read").
   *
   * @note This method does NOT verify task existence. Callers should ensure
   *       that the provided task IDs correspond to valid, non-deleted tasks.
   *
   * @param taskIds - Array of task ObjectIds.
   * @param userId  - The user ObjectId viewing the tasks.
   */
  async markMultipleTasksViewed(
    taskIds: (Types.ObjectId | string)[],
    userId: Types.ObjectId | string,
  ): Promise<void> {
    if (taskIds.length === 0) return;

    const userIdObj = new Types.ObjectId(userId);
    const now = new Date();
    const taskIdObjs = taskIds.map((id) => new Types.ObjectId(id));

    // Bulk upsert TaskView records
    const bulkOps = taskIdObjs.map((taskIdObj) => ({
      updateOne: {
        filter: { taskId: taskIdObj, userId: userIdObj },
        update: {
          $set: { lastViewedAt: now },
          $setOnInsert: {
            taskId: taskIdObj,
            userId: userIdObj,
          },
        },
        upsert: true,
      },
    }));

    await this.taskViewModel.bulkWrite(bulkOps);

    // Bulk reset unreadMap entries
    const userIdStr = userIdObj.toString();
    const taskBulkOps = taskIdObjs.map((taskIdObj) => ({
      updateOne: {
        filter: { _id: taskIdObj },
        update: { $unset: { [`unreadMap.${userIdStr}`]: '' as const } },
      },
    }));

    await this.taskModel.bulkWrite(taskBulkOps);
  }

  // -----------------------------------------------------------------------
  // Unread count queries
  // -----------------------------------------------------------------------

  /**
   * Returns per-task unread counts for a user.
   *
   * Only returns tasks where the user has at least one unread event.
   * Tasks with zero unread are omitted — the client should clear badges
   * for tasks not in this response.
   *
   * @param userId  - The user ObjectId.
   * @param options - Optional limit for pagination.
   *
   * @returns Array of `{ taskId, unreadCount }` pairs.
   */
  async getUnreadCount(
    userId: Types.ObjectId | string,
    options?: { limit?: number },
  ): Promise<TaskUnreadCount[]> {
    const userIdStr = new Types.ObjectId(userId).toString();
    const limit = Math.min(options?.limit ?? 100, 500);

    // Find tasks where unreadMap.<userId> exists and is > 0.
    // Uses a sparse index on unreadMap.<userId> for efficiency.
    const tasks = await this.taskModel
      .find(
        {
          isDeleted: false,
          [`unreadMap.${userIdStr}`]: { $exists: true, $gt: 0 },
        } as Record<string, unknown>,
        {
          _id: 1,
          [`unreadMap.${userIdStr}`]: 1,
        },
      )
      .limit(limit)
      .lean()
      .exec();

    return (tasks as unknown as Array<Record<string, unknown>>).map((task) => {
      const unreadMap = task.unreadMap as Record<string, number> | undefined;
      return {
        taskId: (task._id as Types.ObjectId).toString(),
        unreadCount: unreadMap?.[userIdStr] ?? 0,
      };
    });
  }

  /**
   * Returns the total number of unread events across all tasks for a user.
   * Also returns how many distinct tasks have unread events.
   *
   * This is the primary method for the "badge count" shown on the
   * app icon or navigation drawer.
   *
   * Uses MongoDB aggregation for server-side summation.
   */
  async getAggregatedUnreadCount(
    userId: Types.ObjectId | string,
  ): Promise<AggregatedUnreadSummary> {
    const userIdStr = new Types.ObjectId(userId).toString();

    const result = await this.taskModel
      .aggregate<AggregatedUnreadSummary>([
        {
          $match: {
            isDeleted: false,
            [`unreadMap.${userIdStr}`]: { $exists: true, $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalUnread: { $sum: `$unreadMap.${userIdStr}` },
            taskCount: { $sum: 1 },
          },
        },
      ])
      .exec();

    if (result.length === 0) {
      return { totalUnread: 0, taskCount: 0 };
    }

    return {
      totalUnread: result[0].totalUnread,
      taskCount: result[0].taskCount,
    };
  }

  /**
   * Returns an array of task IDs where the user has at least one unread event.
   *
   * This is a lightweight alternative to `getUnreadCount()` when the client
   * only needs to know *which* tasks have unread (e.g., to highlight them
   * in a task list) without the actual counts.
   */
  async getUnreadTaskIds(userId: Types.ObjectId | string): Promise<string[]> {
    const userIdStr = new Types.ObjectId(userId).toString();

    const tasks = await this.taskModel
      .find(
        {
          isDeleted: false,
          [`unreadMap.${userIdStr}`]: { $exists: true, $gt: 0 },
        } as Record<string, unknown>,
        { _id: 1 },
      )
      .lean()
      .exec();

    return (tasks as unknown as Array<Record<string, unknown>>).map((task) =>
      (task._id as Types.ObjectId).toString(),
    );
  }

  // -----------------------------------------------------------------------
  // Recently viewed tasks
  // -----------------------------------------------------------------------

  /**
   * Returns a cursor-paginated list of recently viewed tasks for a user.
   *
   * Results are ordered by `lastViewedAt` descending (most recent first).
   * Uses cursor-based pagination for stable list rendering in React Native.
   *
   * Each item includes a lightweight task-card payload with the task's
   * current unread count embedded.
   *
   * @param userId  - The user ObjectId.
   * @param cursor  - Cursor for pagination (omit for first page).
   * @param limit   - Items per page (max 50, default 20).
   *
   * @returns Paginated recently viewed tasks with cursor and hasMore flag.
   */
  async getRecentlyViewedTasks(
    userId: Types.ObjectId | string,
    cursor?: string,
    limit: number = 20,
  ): Promise<{
    data: RecentlyViewedTaskItem[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const userIdObj = new Types.ObjectId(userId);
    const effectiveLimit = Math.min(limit, 50);
    const decodedCursor = decodeRecentlyViewedCursor(cursor);

    // Build query
    const filter: Record<string, unknown> = { userId: userIdObj };
    if (decodedCursor) {
      filter.lastViewedAt = { $lt: new Date(decodedCursor.lastViewedAt) };
    }

    // Fetch TaskView records (fetch +1 for hasMore detection)
    const views = await this.taskViewModel
      .find(filter)
      .sort({ lastViewedAt: -1 })
      .limit(effectiveLimit + 1)
      .select('taskId lastViewedAt')
      .lean()
      .exec();

    const hasMore = views.length > effectiveLimit;
    const pageViews = views.slice(0, effectiveLimit);

    if (pageViews.length === 0) {
      return { data: [], nextCursor: null, hasMore: false };
    }

    // Batch-fetch task summaries and unread counts
    const taskIds = pageViews.map((v) => v.taskId);
    const userIdStr = userIdObj.toString();

    const tasks = await this.taskModel
      .find({ _id: { $in: taskIds } } as Record<string, unknown>)
      .select('_id description status priority dueDate dueTime unreadMap')
      .lean()
      .exec();

    // Build a lookup map for quick access
    const taskMap = new Map<string, Record<string, unknown>>();
    for (const task of tasks as unknown as Array<Record<string, unknown>>) {
      taskMap.set((task._id as Types.ObjectId).toString(), task);
    }

    // Build response items
    const data: RecentlyViewedTaskItem[] = [];
    for (const view of pageViews) {
      const taskIdStr = view.taskId.toString();
      const taskData = taskMap.get(taskIdStr);

      // If task was deleted, still include a minimal entry
      if (!taskData) {
        data.push({
          lastViewedAt: view.lastViewedAt?.toISOString?.() ?? '',
          task: {
            _id: taskIdStr,
            description: 'Deleted task',
            status: '',
            priority: '',
            dueDate: '',
            dueTime: '',
            unreadCount: 0,
          },
        });
        continue;
      }

      const unreadMap = taskData.unreadMap as
        | Record<string, number>
        | undefined;
      data.push({
        lastViewedAt: view.lastViewedAt?.toISOString?.() ?? '',
        task: {
          _id: taskIdStr,
          description: taskData.description as string,
          status: taskData.status as string,
          priority: taskData.priority as string,
          dueDate: (taskData.dueDate as Date)?.toISOString?.() ?? '',
          dueTime: taskData.dueTime as string,
          unreadCount: unreadMap?.[userIdStr] ?? 0,
        },
      });
    }

    // Compute next cursor from the last item
    const lastItem = pageViews[pageViews.length - 1];
    const nextCursor = hasMore
      ? encodeRecentlyViewedCursor({
          lastViewedAt:
            lastItem.lastViewedAt?.toISOString?.() ?? new Date().toISOString(),
        })
      : null;

    return { data, nextCursor, hasMore };
  }
}
