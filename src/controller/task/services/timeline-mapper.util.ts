import { Types } from 'mongoose';
import { TaskEventDocument } from '../entities/task-event.entity';
import { TaskDocument } from '../entities/task.entity';
import {
  SerializedTimelineEvent,
  TaskTimelineSummary,
  TimelineActor,
  TimelineAttachmentPreview,
  TimelineDelegationSummary,
} from '../interfaces/timeline.interface';
import { TaskEventType } from '../task.enums';

// ---------------------------------------------------------------------------
// Actor resolver
// ---------------------------------------------------------------------------

/**
 * Map of user IDs to their display metadata.
 * Created by batch-fetching all unique user IDs from a page of events.
 */
export type ActorMap = Map<string, TimelineActor>;

/**
 * Resolves a single user ObjectId to a TimelineActor using the pre-fetched
 * actor map. Returns a fallback actor if the user is not in the map.
 */
export function resolveActor(
  userId: Types.ObjectId | string | null | undefined,
  actorMap: ActorMap,
): TimelineActor {
  if (!userId) {
    return { _id: '', name: 'Unknown' };
  }
  const id = typeof userId === 'string' ? userId : userId.toString();
  return (
    actorMap.get(id) ?? {
      _id: id,
      name: 'User',
    }
  );
}

/**
 * Builds an ActorMap from a list of user documents that have `_id`
 * and optionally `name` and `avatar` fields.
 */
export function buildActorMap(
  users: Array<{
    _id: Types.ObjectId | string;
    name?: string;
    avatar?: string;
  }>,
): ActorMap {
  const map: ActorMap = new Map();
  for (const user of users) {
    const id = typeof user._id === 'string' ? user._id : user._id.toString();
    map.set(id, {
      _id: id,
      name: user.name,
      avatar: user.avatar,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Attachment previews
// ---------------------------------------------------------------------------

/**
 * Builds a map of attachment IDs to their preview payloads for quick lookup.
 */
export function buildAttachmentMap(
  attachments: Array<{
    _id: Types.ObjectId | string;
    type: string;
    url: string;
  }>,
): Map<string, TimelineAttachmentPreview> {
  const map = new Map<string, TimelineAttachmentPreview>();
  for (const att of attachments) {
    const id = typeof att._id === 'string' ? att._id : att._id.toString();
    map.set(id, { _id: id, type: att.type, url: att.url });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Delegation summary
// ---------------------------------------------------------------------------

/**
 * Builds a delegation summary from REASSIGNED event data.
 */
export function buildDelegationSummary(
  data: Record<string, unknown>,
  actorMap: ActorMap,
): TimelineDelegationSummary | undefined {
  const delegatedTo = data.delegatedTo as string | undefined;
  const delegatedBy = data.delegatedBy as string | undefined;
  const to = data.to as string | undefined;

  // If delegation details are present, use them
  if (delegatedTo && delegatedBy) {
    return {
      delegatedTo: resolveActor(delegatedTo, actorMap),
      delegatedBy: resolveActor(delegatedBy, actorMap),
    };
  }

  // Fallback to the `to` field for simple reassignments
  if (to) {
    return {
      delegatedTo: resolveActor(to, actorMap),
      delegatedBy: resolveActor(data.from as string | undefined, actorMap),
    };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Event serializer
// ---------------------------------------------------------------------------

/**
 * Serializes a single TaskEvent document into a mobile-optimized
 * `SerializedTimelineEvent` payload.
 *
 * This is a pure function that:
 *  - Converts ObjectIds to strings
 *  - Resolves actor metadata from the pre-fetched actor map
 *  - Populates attachment previews where applicable
 *  - Injects delegation summaries for REASSIGNED events
 *  - Never includes raw database documents or Mongoose objects
 *
 * @param event         - Raw TaskEvent document.
 * @param actorMap      - Pre-fetched user metadata map.
 * @param attachmentMap - Pre-fetched attachment preview map.
 *
 * @returns A plain JavaScript object safe for JSON serialization.
 */
export function serializeTimelineEvent(
  event: TaskEventDocument,
  actorMap: ActorMap,
  attachmentMap?: Map<string, TimelineAttachmentPreview>,
): SerializedTimelineEvent {
  const id = event._id.toString();
  const data = event.data ?? {};

  // Resolve attachment previews for ATTACHMENT_ADDED events
  let attachmentPreviews: TimelineAttachmentPreview[] | undefined;
  if (
    event.type === TaskEventType.ATTACHMENT_ADDED &&
    attachmentMap &&
    data.attachmentId
  ) {
    const preview = attachmentMap.get(data.attachmentId as string);
    if (preview) {
      attachmentPreviews = [preview];
    }
  }

  // Resolve attachment previews for COMMENTED events that reference attachments
  if (
    event.type === TaskEventType.COMMENTED &&
    attachmentMap &&
    data.attachmentIds
  ) {
    const ids = data.attachmentIds as string[];
    if (Array.isArray(ids) && ids.length > 0) {
      attachmentPreviews = ids
        .map((id) => attachmentMap.get(id))
        .filter(Boolean) as TimelineAttachmentPreview[];
    }
  }

  // Build delegation summary for REASSIGNED events
  let delegationSummary: TimelineDelegationSummary | undefined;
  if (event.type === TaskEventType.REASSIGNED) {
    delegationSummary = buildDelegationSummary(data, actorMap);
  }

  return {
    _id: id,
    type: event.type,
    data,
    createdBy: resolveActor(event.createdBy, actorMap),
    sortKey: event.sortKey,
    createdAt: event.createdAt?.toISOString?.() ?? new Date().toISOString(),
    ...(attachmentPreviews !== undefined && attachmentPreviews.length > 0
      ? { attachmentPreviews }
      : {}),
    ...(delegationSummary !== undefined ? { delegationSummary } : {}),
  };
}

// ---------------------------------------------------------------------------
// Task detail serializer
// ---------------------------------------------------------------------------

/**
 * Serializes a Task document into a lightweight `TaskTimelineSummary` payload
 * for the task header shown above the timeline.
 */
export function serializeTaskTimelineSummary(
  task: TaskDocument,
  unreadCount: number,
  actorMap: ActorMap,
): TaskTimelineSummary {
  const id = task._id.toString();

  // Resolve active owner
  const activeOwner = task.activeOwner
    ? resolveActor(task.activeOwner, actorMap)
    : null;

  // Resolve active delegation
  const activeDelegation = task.activeDelegation
    ? {
        delegatedTo: resolveActor(task.activeDelegation.delegatedTo, actorMap),
        delegatedBy: resolveActor(task.activeDelegation.delegatedBy, actorMap),
        delegatedAt:
          task.activeDelegation.delegatedAt?.toISOString?.() ??
          new Date().toISOString(),
      }
    : null;

  return {
    _id: id,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString?.() ?? '',
    dueTime: task.dueTime,
    activeOwner,
    activeDelegation,
    threadStats: {
      eventCount: task.threadStats?.eventCount ?? 0,
      attachmentCount: task.threadStats?.attachmentCount ?? 0,
      lastEventAt: task.threadStats?.lastEventAt?.toISOString?.() ?? null,
    },
    lastEvent: task.lastEvent
      ? {
          type: task.lastEvent.type,
          by: task.lastEvent.by?.toString() ?? '',
          at: task.lastEvent.at?.toISOString?.() ?? '',
        }
      : null,
    unreadCount,
    createdAt: (task as unknown as Record<string, unknown>)?.createdAt
      ? (
          (task as unknown as Record<string, unknown>).createdAt as Date
        ).toISOString()
      : '',
    assigneeIds: (task.assigneeIds ?? []).map((id) => id.toString()),
    createdBy: task.createdBy?.toString() ?? '',
    outletId: task.outletId?.toString() ?? null,
    taskCategoryId: task.taskCategoryId?.toString() ?? '',
  };
}

// ---------------------------------------------------------------------------
// User ID extraction
// ---------------------------------------------------------------------------

/**
 * Extracts all unique user ObjectIds from a batch of events.
 * Used to batch-fetch actor metadata before serialization.
 */
export function extractUserIdsFromEvents(
  events: TaskEventDocument[],
): string[] {
  const userIds = new Set<string>();
  for (const event of events) {
    if (event.createdBy) {
      userIds.add(event.createdBy.toString());
    }
    if (event.data) {
      const data = event.data;
      if (data.delegatedTo)
        userIds.add((data.delegatedTo as { toString(): string }).toString());
      if (data.delegatedBy)
        userIds.add((data.delegatedBy as { toString(): string }).toString());
      if (data.to) userIds.add((data.to as { toString(): string }).toString());
      if (data.from)
        userIds.add((data.from as { toString(): string }).toString());
    }
  }
  return Array.from(userIds);
}

/**
 * Extracts all attachment ObjectIds from a batch of events.
 * Used to batch-fetch attachment previews before serialization.
 */
export function extractAttachmentIdsFromEvents(
  events: TaskEventDocument[],
): string[] {
  const ids = new Set<string>();
  for (const event of events) {
    if (!event.data) continue;

    if (
      event.type === TaskEventType.ATTACHMENT_ADDED &&
      event.data.attachmentId
    ) {
      ids.add(event.data.attachmentId as string);
    }
    if (
      event.type === TaskEventType.COMMENTED &&
      Array.isArray(event.data.attachmentIds)
    ) {
      for (const id of event.data.attachmentIds as string[]) {
        ids.add(id);
      }
    }
  }
  return Array.from(ids);
}
