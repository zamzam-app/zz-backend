import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from '../entities/task.entity';
import {
  TaskAttachment,
  TaskAttachmentDocument,
} from '../entities/task-attachment.entity';
import { TaskEventService } from './task-event.service';
import { TaskEventType, AttachmentType } from '../task.enums';
import { User, UserDocument } from '../../users/entities/user.entity';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of attachments allowed per batch upload call.
 */
const MAX_ATTACHMENTS_PER_BATCH = 10;

/**
 * Maximum file sizes per attachment type (in bytes).
 */
const FILE_SIZE_LIMITS: Record<AttachmentType, number> = {
  [AttachmentType.IMAGE]: 10 * 1024 * 1024, // 10 MB
  [AttachmentType.VIDEO]: 100 * 1024 * 1024, // 100 MB
  [AttachmentType.AUDIO]: 50 * 1024 * 1024, // 50 MB
  [AttachmentType.FILE]: 50 * 1024 * 1024, // 50 MB
  [AttachmentType.DOCUMENT]: 20 * 1024 * 1024, // 20 MB
};

/**
 * Map of MIME types to their corresponding AttachmentType.
 * Used for server-side MIME validation when the client provides a mimeType.
 */
const MIME_TYPE_MAP: Record<string, AttachmentType> = {
  // Images
  'image/jpeg': AttachmentType.IMAGE,
  'image/png': AttachmentType.IMAGE,
  'image/gif': AttachmentType.IMAGE,
  'image/webp': AttachmentType.IMAGE,
  'image/svg+xml': AttachmentType.IMAGE,
  'image/bmp': AttachmentType.IMAGE,
  // Videos
  'video/mp4': AttachmentType.VIDEO,
  'video/quicktime': AttachmentType.VIDEO,
  'video/x-msvideo': AttachmentType.VIDEO,
  'video/webm': AttachmentType.VIDEO,
  'video/x-matroska': AttachmentType.VIDEO,
  'video/3gpp': AttachmentType.VIDEO,
  // Audio
  'audio/mpeg': AttachmentType.AUDIO,
  'audio/wav': AttachmentType.AUDIO,
  'audio/ogg': AttachmentType.AUDIO,
  'audio/aac': AttachmentType.AUDIO,
  'audio/mp4': AttachmentType.AUDIO,
  'audio/x-m4a': AttachmentType.AUDIO,
  // Documents
  'application/pdf': AttachmentType.DOCUMENT,
  'application/msword': AttachmentType.DOCUMENT,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    AttachmentType.DOCUMENT,
  // Spreadsheets & other files
  'application/vnd.ms-excel': AttachmentType.FILE,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    AttachmentType.FILE,
  'text/plain': AttachmentType.FILE,
  'text/csv': AttachmentType.FILE,
  // Archives
  'application/zip': AttachmentType.FILE,
  'application/gzip': AttachmentType.FILE,
  'application/x-rar-compressed': AttachmentType.FILE,
  'application/x-7z-compressed': AttachmentType.FILE,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input metadata for a single file being attached to a task.
 */
export interface AttachmentFileInput {
  /** Public URL of the uploaded file (from Cloudinary/CDN). */
  url: string;
  /**
   * Attachment type.
   * Must be a valid `AttachmentType` enum value.
   */
  type: AttachmentType | string;
  /**
   * Optional file size in bytes.
   * Used for server-side size validation.
   */
  size?: number;
  /**
   * Optional MIME type (e.g., "image/png").
   * Used for server-side type validation.
   */
  mimeType?: string;
}

/**
 * A single serialized attachment for mobile consumption.
 * Lightweight payload with no Mongoose documents or ObjectId instances.
 */
export interface SerializedTaskAttachment {
  _id: string;
  type: string;
  url: string;
  uploadedBy: {
    _id: string;
    name?: string;
  };
  size?: number;
  mimeType?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * TaskAttachmentService manages the complete attachment lifecycle for
 * threaded tasks.
 *
 * ## Flow
 *
 * 1. **Upload** — The client uploads files to Cloudinary using signed
 *    parameters from `UploadService.getSignedUploadParams()`. Cloudinary
 *    returns a public URL.
 *
 * 2. **Register** — The client calls `addAttachments()` with the URLs and
 *    metadata returned by Cloudinary. The service:
 *    - Validates MIME types, file sizes, and batch limits
 *    - Creates `TaskAttachment` records (one per file)
 *    - Emits `ATTACHMENT_ADDED` events via `TaskEventService.appendEvent`
 *    - The event projection atomically increments `threadStats.attachmentCount`
 *      and updates `unreadMap`
 *
 * 3. **Preview** — Timeline queries (via `TaskThreadQueryService` or
 *    `getTaskAttachments`) batch-fetch attachments with light projections
 *    for inline previews.
 *
 * 4. **Remove** — `removeAttachment()` soft-deletes the attachment record
 *    and emits an `ATTACHMENT_REMOVED` event. The projection decrements
 *    `threadStats.attachmentCount`.
 *
 * ## Consistency Strategy
 *
 * - **Attachments are created FIRST**, then events are emitted. If event
 *   emission fails (version conflict), the attachment record is orphaned.
 *   Best-effort cleanup is attempted. This is the reverse of the delegation
 *   pattern but necessary because events reference `attachmentId`.
 * - In practice, version conflicts during attachment uploads are rare since
 *   each `appendEvent` call increments the version, and concurrent editors
 *   would need to be modifying the same task simultaneously.
 *
 * ## Limits
 *
 * | Limit | Value |
 * |---|---|
 * | Max attachments per batch | 10 |
 * | Max image size | 10 MB |
 * | Max video size | 100 MB |
 * | Max audio size | 50 MB |
 * | Max file size | 50 MB |
 * | Max document size | 20 MB |
 */
@Injectable()
export class TaskAttachmentService {
  constructor(
    @InjectModel(TaskAttachment.name)
    private readonly taskAttachmentModel: Model<TaskAttachmentDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly taskEventService: TaskEventService,
  ) {}

  // -----------------------------------------------------------------------
  // Add attachments
  // -----------------------------------------------------------------------

  /**
   * Registers one or more file attachments for a task.
   *
   * Validation performed:
   *  - Task exists (throws `NotFoundException`)
   *  - Batch size ≤ `MAX_ATTACHMENTS_PER_BATCH` (throws `BadRequestException`)
   *  - `type` is a valid `AttachmentType` (throws `BadRequestException`)
   *  - `mimeType` matches the declared `type` (if provided) (throws `BadRequestException`)
   *  - `size` ≤ per-type limit (if provided) (throws `PayloadTooLargeException`)
   *
   * For each valid attachment, a `TaskAttachment` record is created and an
   * `ATTACHMENT_ADDED` event is appended to the task's event log.
   *
   * @param taskId  - The task ObjectId.
   * @param files   - Array of file metadata inputs (max 10).
   * @param userId  - The user ObjectId uploading the files.
   *
   * @returns Array of serialized attachment records.
   *
   * @throws NotFoundException      if the task is not found or deleted.
   * @throws BadRequestException    if validation fails.
   * @throws PayloadTooLargeException if a file exceeds the size limit.
   */
  async addAttachments(
    taskId: Types.ObjectId | string,
    files: AttachmentFileInput[],
    userId: Types.ObjectId | string,
  ): Promise<SerializedTaskAttachment[]> {
    const taskIdObj = new Types.ObjectId(taskId);
    const userIdObj = new Types.ObjectId(userId);

    // 1. Verify task exists
    const taskExists = await this.taskModel
      .exists({ _id: taskIdObj, isDeleted: false })
      .exec();

    if (!taskExists) {
      throw new NotFoundException('Task not found');
    }

    // 2. Validate batch size
    if (files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    if (files.length > MAX_ATTACHMENTS_PER_BATCH) {
      throw new BadRequestException(
        `Maximum ${MAX_ATTACHMENTS_PER_BATCH} attachments allowed per request`,
      );
    }

    // 3. Validate each file and normalize types
    const validated = files.map((file) => this.validateFileInput(file));

    // 4. Create TaskAttachment records (using create() for timestamp support)
    //    NOTE: insertMany() bypasses Mongoose timestamps middleware.
    const attachmentDocs = await this.taskAttachmentModel.create(
      validated.map((v) => ({
        taskId: taskIdObj,
        uploadedBy: userIdObj,
        type: v.type,
        url: v.url,
        size: v.size,
        mimeType: v.mimeType,
        isDeleted: false,
      })),
    );

    // 5. Emit ATTACHMENT_ADDED events (one per attachment)
    const results: SerializedTaskAttachment[] = [];

    for (let i = 0; i < attachmentDocs.length; i++) {
      const doc = attachmentDocs[i];
      const file = validated[i];

      try {
        await this.taskEventService.appendEvent(
          taskIdObj,
          TaskEventType.ATTACHMENT_ADDED,
          {
            attachmentId: doc._id.toString(),
            type: file.type,
            url: file.url,
            ...(file.mimeType ? { mimeType: file.mimeType } : {}),
            ...(file.size ? { size: file.size } : {}),
          },
          userIdObj,
        );
      } catch {
        // Best-effort cleanup: the TaskAttachment record exists without a
        // corresponding event. Attempt to remove it, but don't block the
        // response for other attachments that succeeded.
        // @todo Log this failure for monitoring.
        try {
          await this.taskAttachmentModel.deleteOne({ _id: doc._id }).exec();
        } catch {
          // Best-effort cleanup failed — orphan record remains
        }
        // Skip this attachment from results
        continue;
      }

      results.push({
        _id: doc._id.toString(),
        type: file.type,
        url: file.url,
        size: doc.size,
        mimeType: doc.mimeType,
        uploadedBy: {
          _id: userIdObj.toString(),
          name: 'User',
        },
        createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
      });
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Remove attachment
  // -----------------------------------------------------------------------

  /**
   * Soft-deletes an attachment and emits an ATTACHMENT_REMOVED event.
   *
   * The attachment is not actually removed from the database — its
   * `isDeleted` flag is set to `true`, and the Task read-model's
   * `threadStats.attachmentCount` is decremented by the event projection.
   *
   * @param attachmentId - The attachment ObjectId.
   * @param userId       - The user ObjectId performing the removal.
   * @param reason       - Optional reason for removal.
   *
   * @throws NotFoundException if the attachment or its task does not exist.
   */
  async removeAttachment(
    attachmentId: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    reason?: string,
  ): Promise<void> {
    const attachmentIdObj = new Types.ObjectId(attachmentId);
    const userIdObj = new Types.ObjectId(userId);

    // 1. Find the attachment (must exist and not be already deleted)
    const attachment = await this.taskAttachmentModel
      .findOne({ _id: attachmentIdObj, isDeleted: false })
      .exec();

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // 2. Soft-delete the attachment record
    await this.taskAttachmentModel
      .updateOne({ _id: attachmentIdObj }, { $set: { isDeleted: true } })
      .exec();

    // 3. Emit ATTACHMENT_REMOVED event
    //    If this fails (version conflict), the attachment is still soft-deleted
    //    but no event is recorded — the threadStats won't be decremented.
    try {
      await this.taskEventService.appendEvent(
        attachment.taskId,
        TaskEventType.ATTACHMENT_REMOVED,
        {
          attachmentId: attachmentIdObj.toString(),
          type: attachment.type,
          ...(reason ? { reason } : {}),
        },
        userIdObj,
      );
    } catch {
      // @todo Log this failure. The attachment is soft-deleted but the
      //       threadStats weren't decremented. A reconciliation job can
      //       recalculate threadStats from the actual attachment count.
    }
  }

  // -----------------------------------------------------------------------
  // Query attachments
  // -----------------------------------------------------------------------

  /**
   * Fetches non-deleted attachments for a task with optional type filtering.
   *
   * Results are ordered by `createdAt` descending (newest first).
   * Uses cursor-based pagination for stable list rendering.
   *
   * Each item includes a lightweight `uploadedBy` actor object with
   * the uploader's ID and name.
   *
   * @param taskId  - The task ObjectId.
   * @param options - Query options (cursor, limit, type filter).
   *
   * @returns Paginated serialized attachments.
   */
  async getTaskAttachments(
    taskId: Types.ObjectId | string,
    options?: {
      cursor?: string;
      limit?: number;
      type?: AttachmentType;
    },
  ): Promise<{
    data: SerializedTaskAttachment[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const taskIdObj = new Types.ObjectId(taskId);
    const limit = Math.min(options?.limit ?? 20, 100);

    // Build query filter
    const filter: Record<string, unknown> = {
      taskId: taskIdObj,
      isDeleted: false,
    };
    if (options?.type) {
      filter.type = options.type;
    }

    // Decode cursor (base64-encoded createdAt ISO string)
    if (options?.cursor) {
      try {
        const raw = Buffer.from(options.cursor, 'base64').toString('utf-8');
        const parsed = JSON.parse(raw) as { createdAt: string };
        if (parsed.createdAt) {
          filter.createdAt = { $lt: new Date(parsed.createdAt) };
        }
      } catch {
        // Invalid cursor — ignore and return first page
      }
    }

    // Fetch attachments (fetch +1 for hasMore detection)
    const attachments = await this.taskAttachmentModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .select('_id type url uploadedBy size mimeType createdAt')
      .lean()
      .exec();

    const hasMore = attachments.length > limit;
    const pageAttachments = attachments.slice(0, limit);

    if (pageAttachments.length === 0) {
      return { data: [], nextCursor: null, hasMore: false };
    }

    // Batch-fetch uploader names
    const userIds = new Set<string>();
    for (const att of pageAttachments) {
      if (att.uploadedBy) {
        userIds.add(att.uploadedBy.toString());
      }
    }

    const userMap = new Map<string, { _id: string; name?: string }>();
    if (userIds.size > 0) {
      const users = await this.userModel
        .find({
          _id: { $in: Array.from(userIds).map((id) => new Types.ObjectId(id)) },
        } as Record<string, unknown>)
        .select('_id name')
        .lean()
        .exec();
      for (const user of users as unknown as Array<{
        _id: Types.ObjectId;
        name?: string;
      }>) {
        userMap.set(user._id.toString(), {
          _id: user._id.toString(),
          name: user.name,
        });
      }
    }

    // Build response
    const data: SerializedTaskAttachment[] = pageAttachments.map((att) => {
      const attDoc = att as unknown as Record<string, unknown>;
      const uploadedById =
        (attDoc.uploadedBy as Types.ObjectId)?.toString() ?? '';
      const uploader = userMap.get(uploadedById);
      return {
        _id: (attDoc._id as Types.ObjectId).toString(),
        type: attDoc.type as string,
        url: attDoc.url as string,
        size: attDoc.size as number | undefined,
        mimeType: attDoc.mimeType as string | undefined,
        uploadedBy: {
          _id: uploadedById,
          name: uploader?.name ?? 'User',
        },
        createdAt: (attDoc.createdAt as Date)?.toISOString?.() ?? '',
      };
    });

    // Compute next cursor
    const lastItem = pageAttachments[pageAttachments.length - 1];
    const lastItemDoc = lastItem as unknown as Record<string, unknown>;
    const lastItemCreatedAt = (lastItemDoc.createdAt as Date)?.toISOString();
    const nextCursor =
      hasMore && lastItemCreatedAt
        ? Buffer.from(
            JSON.stringify({ createdAt: lastItemCreatedAt }),
            'utf-8',
          ).toString('base64')
        : null;

    return { data, nextCursor, hasMore };
  }

  // -----------------------------------------------------------------------
  // Validation helpers
  // -----------------------------------------------------------------------

  /**
   * Validates a single file input and returns normalized metadata.
   *
   * Checks:
   *  - `type` is a valid `AttachmentType`
   *  - `url` is present
   *  - `mimeType` matches the declared `type` (if provided)
   *  - `size` ≤ per-type limit (if provided)
   *
   * @throws BadRequestException    if type/URL validation fails.
   * @throws PayloadTooLargeException if file exceeds size limit.
   */
  private validateFileInput(file: AttachmentFileInput): {
    url: string;
    type: AttachmentType;
    mimeType?: string;
    size?: number;
  } {
    // Validate URL
    if (!file.url || typeof file.url !== 'string') {
      throw new BadRequestException('File URL is required');
    }

    // Validate and normalize type
    const normalizedType = (file.type?.toUpperCase() ?? '') as AttachmentType;
    if (!Object.values(AttachmentType).includes(normalizedType)) {
      throw new BadRequestException(
        `Invalid attachment type: "${file.type}". Must be one of: ${Object.values(AttachmentType).join(', ')}`,
      );
    }

    // Validate MIME type matches declared type
    if (file.mimeType) {
      const expectedType = MIME_TYPE_MAP[file.mimeType.toLowerCase()];
      if (expectedType && expectedType !== normalizedType) {
        throw new BadRequestException(
          `MIME type "${file.mimeType}" does not match declared type "${normalizedType}". Expected "${expectedType}".`,
        );
      }
    }

    // Validate file size
    if (file.size !== undefined) {
      const limit = FILE_SIZE_LIMITS[normalizedType];
      if (file.size > limit) {
        throw new PayloadTooLargeException(
          `File size ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the ${(limit / 1024 / 1024).toFixed(0)} MB limit for type "${normalizedType}"`,
        );
      }
    }

    return {
      url: file.url,
      type: normalizedType,
      mimeType: file.mimeType?.toLowerCase(),
      size: file.size,
    };
  }
}
