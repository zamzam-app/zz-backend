import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from '../entities/task.entity';
import { TaskEvent, TaskEventDocument } from '../entities/task-event.entity';
import {
  TaskAttachment,
  TaskAttachmentDocument,
} from '../entities/task-attachment.entity';
import { User, UserDocument } from '../../users/entities/user.entity';
import { TaskEventType } from '../task.enums';
import {
  PaginatedResponse,
  SerializedTimelineEvent,
  TaskDetailTimelineResponse,
} from '../interfaces/timeline.interface';
import {
  buildCursorQuery,
  buildPaginatedResponse,
  decodeCursor,
} from './task-event-cursor.util';
import {
  buildActorMap,
  buildAttachmentMap,
  extractAttachmentIdsFromEvents,
  extractUserIdsFromEvents,
  serializeTaskTimelineSummary,
  serializeTimelineEvent,
} from './timeline-mapper.util';

/**
 * TaskThreadQueryService handles **read-only** timeline queries for the
 * threaded task system.
 *
 * Responsibilities:
 *  - Cursor-based pagination of the TaskEvent log
 *  - Batch-hydration of actor metadata (avoids N+1 user lookups)
 *  - Batch-hydration of attachment previews (avoids N+1 attachment lookups)
 *  - Event-type filtering
 *  - Task detail + first-page timeline composition
 *  - Lean queries and projection selection for performance
 *
 * This service does NOT write to any collection. All mutations go through
 * `TaskEventService`.
 *
 * ---
 *
 * ## N+1 Prevention Strategy
 *
 * ### Actors (Users)
 * Instead of populating `createdBy` on each event (which would be N+1
 * for a page of 20 events), we:
 *  1. Extract unique userIds from the events
 *  2. Fetch ALL users in a single query with projection `{ _id, name, avatar }`
 *  3. Build a local Map<string, TimelineActor>
 *  4. Resolve each event's actor from the map (O(1) lookup)
 *
 * ### Attachments
 * Instead of joining events to attachments, we:
 *  1. Extract unique attachmentIds from ATTACHMENT_ADDED and COMMENTED events
 *  2. Fetch ALL attachments in a single query with projection `{ _id, type, url }`
 *  3. Inject `attachmentPreviews` during serialization
 *
 * ### Result
 * A page of 20 events with actors and attachment previews requires exactly:
 *  - 1 query for events
 *  - 1 query for users
 *  - 1 query for attachments (if any attachments referenced)
 * Total: **3 queries maximum** (vs N+2 with naive population).
 */
@Injectable()
export class TaskThreadQueryService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskEvent.name)
    private readonly taskEventModel: Model<TaskEventDocument>,
    @InjectModel(TaskAttachment.name)
    private readonly taskAttachmentModel: Model<TaskAttachmentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // -----------------------------------------------------------------------
  // Timeline pagination
  // -----------------------------------------------------------------------

  /**
   * Fetches a paginated page of timeline events for a task.
   *
   * This is the primary timeline method used for infinite scrolling in
   * the React Native FlatList.
   *
   * Optimizations:
   *  - Uses `lean()` for minimal overhead
   *  - Applies projection selection (only needed fields)
   *  - Batch-fetches actor metadata (avoids N+1)
   *  - Batch-fetches attachment previews (avoids N+1)
   *
   * @param taskId  - The task ObjectId.
   * @param options - Pagination options (cursor, limit, type filter).
   *
   * @returns Serialized, mobile-optimized paginated events.
   *
   * @throws NotFoundException if the task does not exist or is deleted.
   */
  async getTimeline(
    taskId: Types.ObjectId | string,
    options?: {
      cursor?: string;
      limit?: number;
      types?: TaskEventType[];
    },
  ): Promise<PaginatedResponse<SerializedTimelineEvent>> {
    const taskIdObj = new Types.ObjectId(taskId);

    // --------------------------------------------------
    // 1. Verify task exists
    // --------------------------------------------------
    const taskExists = await this.taskModel
      .exists({ _id: taskIdObj, isDeleted: false })
      .exec();

    if (!taskExists) {
      throw new NotFoundException('Task not found');
    }

    // --------------------------------------------------
    // 2. Parse cursor
    // --------------------------------------------------
    const cursor = decodeCursor(options?.cursor);
    const limit = Math.min(options?.limit ?? 20, 100);
    const types = options?.types;

    // --------------------------------------------------
    // 3. Build query and fetch events (lean)
    // --------------------------------------------------
    const { filter, sort, effectiveLimit } = buildCursorQuery(
      taskIdObj,
      cursor,
      limit,
      types,
    );

    const events = await this.taskEventModel
      .find(filter)
      .sort(sort)
      .limit(effectiveLimit)
      .select('_id type data createdBy sortKey createdAt')
      .lean()
      .exec();

    // --------------------------------------------------
    // 4. Build paginated response (slice + cursor)
    // --------------------------------------------------
    const {
      data: pageEvents,
      nextCursor,
      hasMore,
    } = buildPaginatedResponse(
      events as unknown as Array<{ sortKey: string } & Record<string, unknown>>,
      limit,
    );

    // Cast back to documents for the serializer
    const eventDocs = pageEvents as unknown as TaskEventDocument[];

    // --------------------------------------------------
    // 5. Batch-fetch actor metadata
    // --------------------------------------------------
    const userIds = extractUserIdsFromEvents(eventDocs);

    // Also include the task's owner and creator for the summary view
    const allUserIds = [...new Set(userIds)];
    const actorMap = await this.fetchActorMap(allUserIds);

    // --------------------------------------------------
    // 6. Batch-fetch attachment previews (if needed)
    // --------------------------------------------------
    const attachmentIds = extractAttachmentIdsFromEvents(eventDocs);
    let attachmentMap:
      | Map<string, { _id: string; type: string; url: string }>
      | undefined;

    if (attachmentIds.length > 0) {
      const attachments = await this.taskAttachmentModel
        .find({
          _id: { $in: attachmentIds.map((id) => new Types.ObjectId(id)) },
          isDeleted: false,
        } as Record<string, unknown>)
        .select('_id type url')
        .lean()
        .exec();
      attachmentMap = buildAttachmentMap(
        attachments as unknown as Array<{
          _id: Types.ObjectId;
          type: string;
          url: string;
        }>,
      );
    }

    // --------------------------------------------------
    // 7. Serialize events
    // --------------------------------------------------
    const serialized = eventDocs.map((event) =>
      serializeTimelineEvent(event, actorMap, attachmentMap),
    );

    return {
      data: serialized,
      nextCursor,
      hasMore,
    };
  }

  // -----------------------------------------------------------------------
  // Task detail + first page
  // -----------------------------------------------------------------------

  /**
   * Fetches a task's summary details along with the first page of timeline
   * events. This is the primary method for the "task detail" screen.
   *
   * Combines two concerns into a single endpoint:
   *  - The task read-model summary (header metadata)
   *  - The first page of the timeline (scrollable list)
   *
   * @param taskId            - The task ObjectId.
   * @param initialTimelineLimit - Events to include in the first page (max 50).
   *
   * @returns Task summary + paginated timeline.
   *
   * @throws NotFoundException if the task does not exist or is deleted.
   */
  async getTaskDetailWithTimeline(
    taskId: Types.ObjectId | string,
    initialTimelineLimit: number = 20,
  ): Promise<TaskDetailTimelineResponse> {
    const taskIdObj = new Types.ObjectId(taskId);
    const limit = Math.min(initialTimelineLimit, 50);

    // --------------------------------------------------
    // 1. Fetch the task document
    // --------------------------------------------------
    const task = await this.taskModel
      .findOne({ _id: taskIdObj, isDeleted: false })
      .select(
        'description status priority dueDate dueTime activeOwner activeDelegation threadStats lastEvent createdBy assigneeIds outletId taskCategoryId version unreadMap createdAt',
      )
      .lean()
      .exec();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // --------------------------------------------------
    // 2. Fetch first page of events
    // --------------------------------------------------
    const events = await this.taskEventModel
      .find({ taskId: taskIdObj })
      .sort({ sortKey: -1 })
      .limit(limit + 1)
      .select('_id type data createdBy sortKey createdAt')
      .lean()
      .exec();

    const {
      data: pageEvents,
      nextCursor,
      hasMore,
    } = buildPaginatedResponse(
      events as unknown as Array<{ sortKey: string } & Record<string, unknown>>,
      limit,
    );
    const eventDocs = pageEvents as unknown as TaskEventDocument[];

    // --------------------------------------------------
    // 3. Batch-fetch actor metadata
    // --------------------------------------------------
    const userIds = extractUserIdsFromEvents(eventDocs);
    const summaryUserIds: string[] = [];
    if (task.activeOwner) summaryUserIds.push(task.activeOwner.toString());
    if (task.activeDelegation?.delegatedTo)
      summaryUserIds.push(task.activeDelegation.delegatedTo.toString());
    if (task.activeDelegation?.delegatedBy)
      summaryUserIds.push(task.activeDelegation.delegatedBy.toString());
    if (task.createdBy) summaryUserIds.push(task.createdBy.toString());

    const allUserIds = [...new Set([...userIds, ...summaryUserIds])];
    const actorMap = await this.fetchActorMap(allUserIds);

    // --------------------------------------------------
    // 4. Batch-fetch attachment previews
    // --------------------------------------------------
    const attachmentIds = extractAttachmentIdsFromEvents(eventDocs);
    let attachmentMap:
      | Map<string, { _id: string; type: string; url: string }>
      | undefined;

    if (attachmentIds.length > 0) {
      const attachments = await this.taskAttachmentModel
        .find({
          _id: {
            $in: attachmentIds.map((id) => new Types.ObjectId(id)),
          },
          isDeleted: false,
        })
        .select('_id type url')
        .lean()
        .exec();
      attachmentMap = buildAttachmentMap(
        attachments as unknown as Array<{
          _id: Types.ObjectId;
          type: string;
          url: string;
        }>,
      );
    }

    // --------------------------------------------------
    // 5. Serialize
    // --------------------------------------------------
    // unreadCount will be resolved by the controller using the current user's ID
    const unreadCount = 0;

    const serializedEvents = eventDocs.map((event) =>
      serializeTimelineEvent(event, actorMap, attachmentMap),
    );

    const summary = serializeTaskTimelineSummary(
      task as unknown as TaskDocument,
      unreadCount,
      actorMap,
    );

    return {
      summary,
      timeline: {
        data: serializedEvents,
        nextCursor,
        hasMore,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Timeline by event type
  // -----------------------------------------------------------------------

  /**
   * Fetches timeline events filtered by one or more event types.
   *
   * Useful for:
   *  - "Show me only comments"
   *  - "Show me only status changes"
   *  - "Show me only attachment activity"
   *
   * Delegates to `getTimeline()` with the `types` filter.
   */
  async getTimelineByType(
    taskId: Types.ObjectId | string,
    types: TaskEventType[],
    options?: {
      cursor?: string;
      limit?: number;
    },
  ): Promise<PaginatedResponse<SerializedTimelineEvent>> {
    if (!types || types.length === 0) {
      return this.getTimeline(taskId, options);
    }

    return this.getTimeline(taskId, {
      ...options,
      types,
    });
  }

  // -----------------------------------------------------------------------
  // Event count
  // -----------------------------------------------------------------------

  /**
   * Returns the total event count for a task.
   */
  async getEventCount(taskId: Types.ObjectId | string): Promise<number> {
    return this.taskEventModel
      .countDocuments({ taskId: new Types.ObjectId(taskId) })
      .exec();
  }

  /**
   * Returns event counts grouped by type for a task.
   * Useful for the "filter by type" chip UI.
   */
  async getEventTypeCounts(
    taskId: Types.ObjectId | string,
  ): Promise<Record<string, number>> {
    const taskIdObj = new Types.ObjectId(taskId);

    const result = await this.taskEventModel
      .aggregate<{
        _id: string;
        count: number;
      }>([
        { $match: { taskId: taskIdObj } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .exec();

    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row._id] = row.count;
    }
    return counts;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Batch-fetches user metadata for a list of user IDs.
   * Returns a Map<string, TimelineActor> for O(1) local lookups.
   */
  private async fetchActorMap(
    userIds: string[],
  ): Promise<Map<string, { _id: string; name?: string; avatar?: string }>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const uniqueIds = [...new Set(userIds)]
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (uniqueIds.length === 0) {
      return new Map();
    }

    const users = await this.userModel
      .find({ _id: { $in: uniqueIds } } as Record<string, unknown>)
      .select('_id name avatar')
      .lean()
      .exec();

    return buildActorMap(
      users as unknown as Array<{
        _id: Types.ObjectId;
        name?: string;
        avatar?: string;
      }>,
    );
  }
}
