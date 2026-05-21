import { Types } from 'mongoose';
import { TimelineCursor } from '../interfaces/timeline.interface';

// ---------------------------------------------------------------------------
// Cursor encoding / decoding
// ---------------------------------------------------------------------------

/**
 * Encodes a cursor for the previous page into a base64 string.
 *
 * The cursor stores the `sortKey` of the last event in the current page.
 * When the client passes this back, it's used as `sortKey: { $lt: cursor }`.
 *
 * Example:
 *   encodeCursor({ sortKey: 'm0d8f1-a1b2c3d4' })
 *   // → 'eyJzb3J0S2V5IjoibTBkOGYxLWExYjJjM2Q0In0='
 */
export function encodeCursor(cursor: TimelineCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf-8').toString('base64');
}

/**
 * Decodes a cursor from a base64 string back to a TimelineCursor.
 *
 * Example:
 *   decodeCursor('eyJzb3J0S2V5IjoibTBkOGYxLWExYjJjM2Q0In0=')
 *   // → { sortKey: 'm0d8f1-a1b2c3d4' }
 *
 * Returns `null` if the string is empty, malformed, or fails to parse.
 */
export function decodeCursor(
  encoded: string | undefined | null,
): TimelineCursor | null {
  if (!encoded) {
    return null;
  }

  try {
    const raw = Buffer.from(encoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(raw) as TimelineCursor;

    if (!parsed.sortKey || typeof parsed.sortKey !== 'string') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Builds the MongoDB query filter for cursor-based pagination.
 *
 * @param taskId  - The task to scope the query to.
 * @param cursor  - Decoded cursor (null for first page).
 * @param limit   - Max results per page (fetches `limit + 1` for hasMore detection).
 * @param types   - Optional event type filter.
 *
 * @returns The filter object, sort spec, and effective limit.
 */
export function buildCursorQuery(
  taskId: Types.ObjectId,
  cursor: TimelineCursor | null,
  limit: number,
  types?: string[],
): {
  filter: Record<string, unknown>;
  sort: Record<string, 1 | -1>;
  effectiveLimit: number;
} {
  const filter: Record<string, unknown> = { taskId };

  if (cursor) {
    filter.sortKey = { $lt: cursor.sortKey };
  }

  if (types && types.length > 0) {
    filter.type = { $in: types };
  }

  return {
    filter,
    sort: { sortKey: -1 },
    effectiveLimit: limit + 1, // fetch one extra for hasMore detection
  };
}

/**
 * Builds the pagination response envelope from a fetched batch of events.
 *
 * @param items        - The raw events (may include the extra "hasMore" event).
 * @param limit        - The requested limit (not limit+1).
 * @param taskId       - The task ID (for potential cursor reuse).
 * @param total        - Optional total count for informational display.
 *
 * @returns The data slice, next cursor, and hasMore flag.
 */
export function buildPaginatedResponse<T extends { sortKey: string }>(
  items: T[],
  limit: number,
  total?: number,
): {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
} {
  const hasMore = items.length > limit;
  const data = items.slice(0, limit);
  const nextCursor = hasMore
    ? encodeCursor({ sortKey: data[data.length - 1].sortKey })
    : null;

  return {
    data,
    nextCursor,
    hasMore,
    ...(total !== undefined ? { total } : {}),
  };
}
