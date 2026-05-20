// ---------------------------------------------------------------------------
// Cursor pagination
// ---------------------------------------------------------------------------

/**
 * Raw cursor value used internally by the cursor utils.
 * Encoded as base64 JSON for API transport.
 */
export interface TimelineCursor {
  /** The sortKey of the last event in the current page. */
  sortKey: string;
}

/**
 * Standard paginated response envelope.
 */
export interface PaginatedResponse<T> {
  /** Array of items for the current page. */
  data: T[];
  /**
   * Cursor for the next page.
   * Pass this value as the `cursor` query parameter to get the next page.
   * `null` when there are no more events.
   */
  nextCursor: string | null;
  /** Whether more pages are available after this one. */
  hasMore: boolean;
  /** Total number of events (for informational display only; not accurate for filtered queries). */
  total?: number;
}

// ---------------------------------------------------------------------------
// Serialized timeline event
// ---------------------------------------------------------------------------

/**
 * Compact actor metadata for a timeline event.
 * Three-field payload optimized for React Native rendering — no nested lookups needed.
 */
export interface TimelineActor {
  _id: string;
  name?: string;
  avatar?: string;
}

/**
 * Compact attachment preview embedded in timeline events.
 */
export interface TimelineAttachmentPreview {
  /** Attachment ObjectId as string. */
  _id: string;
  /** Attachment type (IMAGE, VIDEO, etc.). */
  type: string;
  /** Display URL. */
  url: string;
}

/**
 * Delegation summary embedded in REASSIGNED events.
 */
export interface TimelineDelegationSummary {
  delegatedTo: TimelineActor;
  delegatedBy: TimelineActor;
}

/**
 * A single serialized timeline event for mobile consumption.
 *
 * This is the **core payload** for the React Native FlatList.
 * Every field is optimized for rendering — no deep nested objects,
 * no unnecessary data, no ObjectId instances.
 */
export interface SerializedTimelineEvent {
  /** Event ObjectId as string. */
  _id: string;
  /** Event type (e.g., "COMMENTED", "ATTACHMENT_ADDED"). */
  type: string;
  /** Event-type-specific payload (contents vary by type). */
  data: Record<string, unknown>;
  /** Actor who created the event (already resolved with name/avatar). */
  createdBy: TimelineActor;
  /** The sort key for stable ordering. */
  sortKey: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /**
   * Optional attachment previews (only populated for ATTACHMENT_ADDED
   * and COMMENTED events that reference attachments).
   */
  attachmentPreviews?: TimelineAttachmentPreview[];
  /**
   * Optional delegation summary (only for REASSIGNED events).
   */
  delegationSummary?: TimelineDelegationSummary;
}

// ---------------------------------------------------------------------------
// Task detail response (summary + first timeline page)
// ---------------------------------------------------------------------------

/**
 * Response for the task detail endpoint that returns both the task summary
 * and the first page of timeline events.
 */
export interface TaskDetailTimelineResponse {
  /**
   * Summary-level metadata (from the Task read-model).
   * Includes threadStats, lastEvent, activeDelegation, etc.
   */
  summary: TaskTimelineSummary;
  /** The first page of timeline events. */
  timeline: PaginatedResponse<SerializedTimelineEvent>;
}

/**
 * Lightweight task summary returned in timeline / detail responses.
 */
export interface TaskTimelineSummary {
  _id: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  dueTime: string;
  activeOwner?: TimelineActor | null;
  activeDelegation?: {
    delegatedTo: TimelineActor;
    delegatedBy: TimelineActor;
    delegatedAt: string;
  } | null;
  threadStats: {
    eventCount: number;
    attachmentCount: number;
    lastEventAt: string | null;
  };
  lastEvent: {
    type: string;
    by: string;
    at: string;
  } | null;
  unreadCount: number;
  createdAt: string;
  assigneeIds: string[];
  createdBy: string;
  outletId: string | null;
  taskCategoryId: string;
}
