import { Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Task visibility
// ---------------------------------------------------------------------------
//
// One rule decides which tasks a non-admin sees in their Tasks list, which
// tasks they get unread counts for, and which task pushes they receive:
//
//   - Admins:     every task.
//   - Non-admins: tasks they are assigned to (`assigneeIds`) or created.
//
// Delegating or reassigning a task adds the target to `assigneeIds` (see the
// REASSIGNED projection), so "delegated to me" is the same as "assigned to me".
//
// TRANSITIONAL: tasks delegated before that change may have a delegate who is
// not in `assigneeIds`. Until `scripts/backfill-task-assignees.ts` has run in
// every environment, the current delegate is also treated as visible. Remove
// the `activeDelegation.delegatedTo` parts below (and in the list query's
// `assigneeId` filter) once the backfill is done.

type IdLike = Types.ObjectId | string;

export type TaskAudienceSource = {
  assigneeIds?: IdLike[] | null;
  createdBy?: IdLike | null;
  activeDelegation?: { delegatedTo?: IdLike | null } | null;
};

/**
 * Mongo filter matching the tasks a non-admin user can see.
 * Admins see every task, so callers skip this filter for them.
 */
export function buildTaskVisibilityFilter(
  userId: IdLike,
): Record<string, unknown> {
  const id = new Types.ObjectId(userId);
  return {
    $or: [
      { assigneeIds: id },
      { createdBy: id },
      // TRANSITIONAL (see file header).
      { 'activeDelegation.delegatedTo': id },
    ],
  };
}

/**
 * Everyone who can see the task: all admins, the assignees, the creator and
 * (transitionally) the current delegate. Unread counts and task pushes go to
 * this audience, minus whoever performed the action.
 */
export function computeTaskAudience(
  task: TaskAudienceSource,
  adminIds: Iterable<string>,
): Set<string> {
  const audience = new Set<string>(adminIds);

  for (const id of task.assigneeIds ?? []) {
    if (id) audience.add(id.toString());
  }
  if (task.createdBy) {
    audience.add(task.createdBy.toString());
  }
  // TRANSITIONAL (see file header).
  if (task.activeDelegation?.delegatedTo) {
    audience.add(task.activeDelegation.delegatedTo.toString());
  }

  return audience;
}
