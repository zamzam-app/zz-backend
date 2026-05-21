import { Types } from 'mongoose';
import { AttachmentType, TaskPriority, TaskStatus } from '../task.enums';

/**
 * Typed payloads for each TaskEventType.
 * The `data` field on TaskEvent is `Record<string, unknown>`, but these
 * types provide compile-time safety when constructing or consuming events.
 */

export interface CreatedEventPayload {
  description: string;
  taskCategoryId: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  dueTime: string;
  isRecurring: boolean;
  recurrenceType?: string;
  recurrenceDays?: number[];
  outletId?: string | null;
  assigneeIds: string[];
}

export interface UpdatedEventPayload {
  changes: Record<string, { from: unknown; to: unknown }>;
}

export interface StatusChangedEventPayload {
  from: TaskStatus;
  to: TaskStatus;
}

export interface CompletedEventPayload {
  completedAt: Date;
  submission?: {
    text?: string;
    attachments?: string[];
  };
}

export interface ReopenedEventPayload {
  previousStatus: TaskStatus;
  reason?: string;
}

export interface PriorityChangedEventPayload {
  from: TaskPriority;
  to: TaskPriority;
}

export interface DueDateChangedEventPayload {
  from: Date;
  to: Date;
  reason?: string;
}

export interface AssignedEventPayload {
  added: string[];
  removed: string[];
}

export interface ReassignedEventPayload {
  from: string;
  to: string;
  reason?: string;
}

export interface CommentedEventPayload {
  text: string;
  attachmentIds?: string[];
}

export interface AttachmentAddedEventPayload {
  attachmentId: string;
  type: AttachmentType;
  url: string;
  metadata?: Record<string, unknown>;
}

export interface AttachmentRemovedEventPayload {
  attachmentId: string;
  reason?: string;
}

export interface SubmittedEventPayload {
  role: 'admin' | 'manager';
  text?: string;
  attachments?: string[];
}

export interface RecurrenceCreatedEventPayload {
  newTaskId: string | Types.ObjectId;
  fromTemplateId: string | Types.ObjectId;
}

/**
 * Union type mapping event types to their payloads.
 * For events not listed, `Record<string, unknown>` is the fallback.
 */
export type TaskEventPayloadMap = {
  CREATED: CreatedEventPayload;
  UPDATED: UpdatedEventPayload;
  STATUS_CHANGED: StatusChangedEventPayload;
  COMPLETED: CompletedEventPayload;
  REOPENED: ReopenedEventPayload;
  PRIORITY_CHANGED: PriorityChangedEventPayload;
  DUE_DATE_CHANGED: DueDateChangedEventPayload;
  ASSIGNED: AssignedEventPayload;
  REASSIGNED: ReassignedEventPayload;
  COMMENTED: CommentedEventPayload;
  ATTACHMENT_ADDED: AttachmentAddedEventPayload;
  ATTACHMENT_REMOVED: AttachmentRemovedEventPayload;
  SUBMITTED: SubmittedEventPayload;
  RECURRENCE_CREATED: RecurrenceCreatedEventPayload;
};

/**
 * Helper type to extract the payload for a given event type.
 */
export type EventPayload<T extends keyof TaskEventPayloadMap> =
  TaskEventPayloadMap[T];
