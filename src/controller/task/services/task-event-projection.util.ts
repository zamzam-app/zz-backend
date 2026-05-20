import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { TaskDocument } from '../entities/task.entity';
import { TaskEventType, TaskStatus } from '../task.enums';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectionUpdate {
  /** Fields to set via `$set`. */
  $set: Record<string, unknown>;
  /** Fields to increment via `$inc`. */
  $inc: Record<string, number>;
  /** Fields to unset via `$unset`. */
  $unset: Record<string, ''>;
}

// ---------------------------------------------------------------------------
// sortKey generation
// ---------------------------------------------------------------------------

/**
 * Generates a globally-unique, chronologically-ordered sort key.
 *
 * Format: `<base36-timestamp>-<8-hex-random>`
 *
 * Examples:
 *   `m0d8f1-a1b2c3d4`
 *   `m0d8f2-e5f6a7b8`
 *
 * Guarantees unique ordering even when multiple events are created
 * within the same millisecond.
 */
export function generateSortKey(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `${timestamp}-${random}`;
}

// ---------------------------------------------------------------------------
// Unread-map computation
// ---------------------------------------------------------------------------

/**
 * Computes the set of user IDs whose `unreadMap` entry should be incremented
 * for a given event.
 *
 * Rules:
 * - The event **actor** never gets their own unread incremented.
 * - All current assignees, the active owner, the delegated-to user, and
 *   the task creator all get increments — **unless** they are the actor.
 *
 * This ensures that:
 * - The user who performed the action doesn't see it as "unread".
 * - Everyone else who should know about it sees a badge.
 */
export function computeUnreadIncrementUserIds(
  task: Pick<
    TaskDocument,
    'assigneeIds' | 'activeOwner' | 'activeDelegation' | 'createdBy'
  >,
  actorId: Types.ObjectId,
): string[] {
  const userIds = new Set<string>();
  const actorStr = actorId.toString();

  const addIfNotActor = (id: Types.ObjectId | string | null | undefined) => {
    if (!id) return;
    if (id.toString() !== actorStr) {
      userIds.add(id.toString());
    }
  };

  // Assignees
  for (const id of task.assigneeIds ?? []) {
    addIfNotActor(id);
  }

  // Active owner
  addIfNotActor(task.activeOwner);

  // Active delegation target
  addIfNotActor(task.activeDelegation?.delegatedTo);

  // Task creator
  addIfNotActor(task.createdBy);

  return Array.from(userIds);
}

// ---------------------------------------------------------------------------
// Projection computation
// ---------------------------------------------------------------------------

/**
 * Computes the `$set`, `$inc`, and `$unset` operations needed to update
 * the Task read-model for a given event type.
 *
 * This is the **single source of truth** for how events project onto
 * the Task document. Every event type that modifies the Task should be
 * handled here.
 */
export function computeProjection(
  type: TaskEventType,
  data: Record<string, unknown>,
  currentTask: Pick<
    TaskDocument,
    | 'status'
    | 'activeOwner'
    | 'assigneeIds'
    | 'threadStats'
    | 'activeDelegation'
    | 'createdBy'
  >,
  actorId: Types.ObjectId,
  now: Date,
): ProjectionUpdate {
  const $set: Record<string, unknown> = {};
  const $inc: Record<string, number> = {};
  const $unset: Record<string, ''> = {};

  // --------------------------------------------------
  // Common updates applied to every event
  // --------------------------------------------------
  $set['lastEvent.type'] = type;
  $set['lastEvent.by'] = actorId;
  $set['lastEvent.at'] = now;
  $set['threadStats.lastEventAt'] = now;
  $inc['threadStats.eventCount'] = 1;

  // --------------------------------------------------
  // Event-type-specific projections
  // --------------------------------------------------
  switch (type) {
    case TaskEventType.CREATED:
      $set['activeOwner'] = actorId;
      break;

    case TaskEventType.COMMENTED:
      // Only common updates apply
      break;

    case TaskEventType.STATUS_CHANGED: {
      const newStatus = data.to as TaskStatus;
      $set['status'] = newStatus;
      if (newStatus === TaskStatus.COMPLETED) {
        $set['completedAt'] = now;
      }
      break;
    }

    case TaskEventType.COMPLETED: {
      $set['status'] = TaskStatus.COMPLETED;
      $set['completedAt'] = data.completedAt ?? now;
      break;
    }

    case TaskEventType.REOPENED: {
      $set['status'] = TaskStatus.OPEN;
      $unset['completedAt'] = '';
      break;
    }

    case TaskEventType.ASSIGNED: {
      const added = (data.added as string[]) ?? [];
      const removed = (data.removed as string[]) ?? [];

      // Build the new assignee list by removing and adding
      const currentIds = (currentTask.assigneeIds ?? []).map((id) =>
        id.toString(),
      );
      const newIds = [
        ...currentIds.filter((id) => !removed.includes(id)),
        ...added,
      ];

      // Deduplicate
      const uniqueIds = [...new Set(newIds)].map(
        (id) => new Types.ObjectId(id),
      );
      $set['assigneeIds'] = uniqueIds;

      // Update activeOwner if the previous owner was removed
      const currentOwnerStr = currentTask.activeOwner?.toString();
      if (currentOwnerStr && removed.includes(currentOwnerStr)) {
        // Pick the first new assignee or fall back to the first added
        const newOwner = added[0] ?? uniqueIds[0]?.toString();
        if (newOwner) {
          $set['activeOwner'] = new Types.ObjectId(newOwner);
        }
      }
      break;
    }

    case TaskEventType.REASSIGNED: {
      const toId = data.to as string;
      if (toId) {
        $set['activeOwner'] = new Types.ObjectId(toId);
      }

      // If delegation details are in the event data, set activeDelegation
      // sub-document atomically (used by delegateTask).
      if (data.delegatedTo && data.delegatedBy) {
        $set['activeDelegation'] = {
          delegatedTo: new Types.ObjectId(data.delegatedTo as string),
          delegatedBy: new Types.ObjectId(data.delegatedBy as string),
          delegatedAt: now,
        };
      }

      // If the delegation is being revoked, clear activeDelegation
      // and restore the activeOwner to the original delegator or
      // the task creator.
      if (data.revokeDelegation === true) {
        $unset['activeDelegation'] = '';
        const restoreTo =
          currentTask.activeDelegation?.delegatedBy ?? currentTask.createdBy;
        if (restoreTo) {
          $set['activeOwner'] = restoreTo;
        }
      }
      break;
    }

    case TaskEventType.ATTACHMENT_ADDED:
      $inc['threadStats.attachmentCount'] = 1;
      break;

    case TaskEventType.ATTACHMENT_REMOVED:
      $inc['threadStats.attachmentCount'] = -1;
      break;

    case TaskEventType.PRIORITY_CHANGED:
      $set['priority'] = data.to as string;
      break;

    case TaskEventType.DUE_DATE_CHANGED:
      $set['dueDate'] = new Date(data.to as string | Date);
      break;

    case TaskEventType.SUBMITTED: {
      const role = data.role as string;
      if (role === 'admin') {
        $set['adminSubmission.text'] = (data.text as string) ?? '';
        $set['adminSubmission.createdBy'] = actorId;
        $set['adminSubmission.createdAt'] = now;
        $set['adminSubmission.updatedAt'] = now;
      } else {
        $set['managerSubmission.text'] = (data.text as string) ?? '';
        $set['managerSubmission.createdBy'] = actorId;
        $set['managerSubmission.createdAt'] = now;
        $set['managerSubmission.updatedAt'] = now;
      }
      break;
    }

    case TaskEventType.RECURRENCE_CREATED:
      // No Task field changes — the new task instance is a separate document
      break;

    default:
      // Unknown event types only apply common updates
      break;
  }

  return { $set, $inc, $unset };
}
