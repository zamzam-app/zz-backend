import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from '../entities/task.entity';
import {
  TaskDelegation,
  TaskDelegationDocument,
} from '../entities/task-delegation.entity';
import { User, UserDocument } from '../../users/entities/user.entity';
import { Outlet, OutletDocument } from '../../outlet/entities/outlet.entity';
import { UserRole } from '../../users/interfaces/user.interface';
import { TaskEventType } from '../task.enums';
import { TaskEventService } from './task-event.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DelegateTaskResult {
  /** The result from TaskEventService.delegateTask. */
  event: { event: unknown; task: TaskDocument };
}

export interface ReassignTaskResult {
  /** The appended REASSIGNED event. */
  event: { event: unknown; task: TaskDocument };
}

export interface ClearDelegationResult {
  /** The appended REASSIGNED (revoke) event. */
  event: { event: unknown; task: TaskDocument };
}

export interface DelegationRecord {
  _id: string;
  taskId: string;
  delegatedBy: string;
  delegatedTo: string;
  note?: string | null;
  createdAt: string;
  delegatedByName?: string;
  delegatedToName?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * TaskDelegationService manages the **delegation and ownership lifecycle**
 * for the threaded task workflow.
 *
 * It provides three core operations:
 *
 * | Operation | Effect | TaskDelegation record | activeOwner | activeDelegation |
 * |---|---|---|---|---|
 * | `delegateTask` | Temporary hand-off | ✅ Created | → delegatedTo | ✅ Set |
 * | `reassignTask` | Permanent ownership transfer | ❌ None | → newOwner | ❌ Cleared |
 * | `clearDelegation` | Revoke pending delegation | ❌ None | → Restored | ❌ Cleared |
 *
 * All operations emit a `REASSIGNED` event through `TaskEventService`,
 * ensuring the event log, Task read-model, and delegation edge records
 * remain consistent.
 *
 * ---
 *
 * ## Validation rules
 *
 * - **Self-delegation**: Delegating to yourself is rejected.
 * - **Assignee exists**: The target user must exist and not be deleted.
 * - **Assignee role**: Only `MANAGER` and `ADMIN` users can receive delegations.
 * - **Outlet access**: If the task belongs to an outlet, both the delegator
 *   and delegatee must have access to that outlet.
 * - **Active delegation**: Re-delegating (delegating when a delegation is
 *   already active) is allowed — the existing delegation is overridden.
 */
@Injectable()
export class TaskDelegationService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskDelegation.name)
    private readonly taskDelegationModel: Model<TaskDelegationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Outlet.name)
    private readonly outletModel: Model<OutletDocument>,
    private readonly taskEventService: TaskEventService,
  ) {}

  // -----------------------------------------------------------------------
  // Core operations
  // -----------------------------------------------------------------------

  /**
   * Delegates a task to another user.
   *
   * This is a **temporary hand-off**:
   * - The delegated user becomes `activeOwner`.
   * - An `activeDelegation` sub-document records who delegated and when.
   * - A `TaskDelegation` edge record is created for the audit trail.
   * - The `REASSIGNED` event captures `delegatedTo`, `delegatedBy`, and `note`.
   *
   * If the task already has an active delegation, it is overridden
   * (the previous delegation is replaced by the new one).
   *
   * @param taskId       - The task to delegate.
   * @param delegatedBy  - The user performing the delegation (current owner).
   * @param delegatedTo  - The user receiving the delegation (new temporary owner).
   * @param note         - Optional reason / context for the delegation.
   *
   * @throws NotFoundException - If the task or target user does not exist.
   * @throws BadRequestException - If self-delegation is attempted or target
   *                               user is not eligible (role, outlet access).
   */
  async delegateTask(
    taskId: Types.ObjectId | string,
    delegatedBy: Types.ObjectId | string,
    delegatedTo: Types.ObjectId | string,
    note?: string,
  ): Promise<DelegateTaskResult> {
    const taskIdObj = new Types.ObjectId(taskId);
    const fromId = new Types.ObjectId(delegatedBy);
    const toId = new Types.ObjectId(delegatedTo);

    // --------------------------------------------------
    // 1. Validate task exists
    // --------------------------------------------------
    const task = await this.taskModel
      .findOne({ _id: taskIdObj, isDeleted: false })
      .select('outletId activeOwner activeDelegation createdBy version')
      .lean()
      .exec();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // --------------------------------------------------
    // 2. Validate target user
    // --------------------------------------------------
    await this.validateDelegationTarget(task, fromId, toId);

    // --------------------------------------------------
    // 3. Delegate via TaskEventService
    //    This handles: event creation + projection + delegation record
    //
    // @todo Add MongoDB transaction once replica set is available.
    // Currently, if the delegation edge record creation fails inside
    // TaskEventService.delegateTask(), the event still exists and the
    // edge record can be backfilled from the event log.
    // --------------------------------------------------
    const result = await this.taskEventService.delegateTask(
      taskIdObj,
      fromId,
      toId,
      note,
    );

    return {
      event: result as unknown as { event: unknown; task: TaskDocument },
    };
  }

  /**
   * Reassigns a task to a new owner (full ownership transfer).
   *
   * Unlike `delegateTask`, this is a **permanent transfer**:
   * - The new owner becomes `activeOwner`.
   * - Any existing `activeDelegation` is **cleared** (the projection
   *   handles this via the `$unset` in the reassignment branch).
   * - No `TaskDelegation` edge record is created.
   * - The event is `REASSIGNED` with `{ from, to }` — delegation meta
   *   is intentionally absent so the projection treats it as a full
   *   ownership transfer, not a temporary delegation.
   *
   * @param taskId         - The task to reassign.
   * @param reassignedBy   - The user performing the reassignment.
   * @param newOwnerId     - The user who will become the new owner.
   * @param reason         - Optional reason for the reassignment.
   *
   * @throws NotFoundException - If the task or target user does not exist.
   * @throws BadRequestException - If self-reassignment or ineligible target.
   */
  async reassignTask(
    taskId: Types.ObjectId | string,
    reassignedBy: Types.ObjectId | string,
    newOwnerId: Types.ObjectId | string,
    reason?: string,
  ): Promise<ReassignTaskResult> {
    const taskIdObj = new Types.ObjectId(taskId);
    const actorId = new Types.ObjectId(reassignedBy);
    const newOwnerObj = new Types.ObjectId(newOwnerId);

    // --------------------------------------------------
    // 1. Validate task exists
    // --------------------------------------------------
    const task = await this.taskModel
      .findOne({ _id: taskIdObj, isDeleted: false })
      .select('outletId activeOwner createdBy version')
      .lean()
      .exec();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // --------------------------------------------------
    // 2. Validate target user
    // --------------------------------------------------
    await this.validateDelegationTarget(task, actorId, newOwnerObj);

    // --------------------------------------------------
    // 3. Emit REASSIGNED event (no delegation meta → full transfer)
    // --------------------------------------------------
    const result = await this.taskEventService.appendEvent(
      taskIdObj,
      TaskEventType.REASSIGNED,
      {
        from: task.activeOwner?.toString() ?? task.createdBy?.toString() ?? '',
        to: newOwnerObj.toString(),
        ...(reason ? { reason } : {}),
      },
      actorId,
    );

    return { event: result as unknown as { event: unknown; task: TaskDocument } };
  }

  /**
   * Clears an active delegation, restoring the original owner.
   *
   * The `activeOwner` is restored to the original delegator
   * (`activeDelegation.delegatedBy`) or falls back to the task creator.
   *
   * @param taskId    - The task whose delegation should be cleared.
   * @param userId    - The user requesting the clearance.
   *
   * @throws NotFoundException - If the task does not exist.
   * @throws BadRequestException - If the task has no active delegation.
   */
  async clearDelegation(
    taskId: Types.ObjectId | string,
    userId: Types.ObjectId | string,
  ): Promise<ClearDelegationResult> {
    const taskIdObj = new Types.ObjectId(taskId);
    const actorId = new Types.ObjectId(userId);

    // --------------------------------------------------
    // 1. Verify task exists and has an active delegation
    // --------------------------------------------------
    const task = await this.taskModel
      .findOne({ _id: taskIdObj, isDeleted: false })
      .select('activeDelegation')
      .lean()
      .exec();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (!task.activeDelegation) {
      throw new BadRequestException(
        'Task does not have an active delegation to clear',
      );
    }

    // --------------------------------------------------
    // 2. Delegate to TaskEventService.revokeDelegation
    // --------------------------------------------------
    const result = await this.taskEventService.revokeDelegation(
      taskIdObj,
      actorId,
    );

    return { event: result as unknown as { event: unknown; task: TaskDocument } };
  }

  // -----------------------------------------------------------------------
  // Query helpers
  // -----------------------------------------------------------------------

  /**
   * Returns the delegation audit trail for a task (chronological, newest
   * first). Each record includes basic information about who delegated
   * to whom and when.
   */
  async getDelegationHistory(
    taskId: Types.ObjectId | string,
    options?: { limit?: number; skip?: number },
  ): Promise<DelegationRecord[]> {
    const taskIdObj = new Types.ObjectId(taskId);
    const limit = options?.limit ?? 50;
    const skip = options?.skip ?? 0;

    const records = await this.taskDelegationModel
      .find({ taskId: taskIdObj })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return records.map((r) => ({
      _id: r._id.toString(),
      taskId: r.taskId.toString(),
      delegatedBy: r.delegatedBy.toString(),
      delegatedTo: r.delegatedTo.toString(),
      note: r.note,
      createdAt: r.createdAt?.toISOString?.() ?? '',
    }));
  }

  /**
   * Returns all tasks currently delegated to a specific user.
   * Useful for a \"Tasks delegated to me\" view.
   */
  async getActiveDelegationsForUser(
    userId: Types.ObjectId | string,
    options?: { limit?: number; skip?: number },
  ): Promise<
    Array<{
      taskId: string;
      delegatedBy: string;
      delegatedAt: string;
    }>
  > {
    const userIdObj = new Types.ObjectId(userId);
    const limit = options?.limit ?? 50;
    const skip = options?.skip ?? 0;

    const tasks = await this.taskModel
      .find({
        isDeleted: false,
        'activeDelegation.delegatedTo': userIdObj,
      } as Record<string, unknown>)
      .select('activeDelegation _id')
      .sort({ 'activeDelegation.delegatedAt': -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return tasks.map((t) => ({
      taskId: t._id.toString(),
      delegatedBy: t.activeDelegation?.delegatedBy?.toString() ?? '',
      delegatedAt:
        t.activeDelegation?.delegatedAt?.toISOString?.() ?? '',
    }));
  }

  /**
   * Returns delegation records created by a specific user.
   * Useful for a \"Tasks I delegated\" view.
   */
  async getDelegationsByUser(
    userId: Types.ObjectId | string,
    options?: { limit?: number; skip?: number },
  ): Promise<DelegationRecord[]> {
    const userIdObj = new Types.ObjectId(userId);
    const limit = options?.limit ?? 50;
    const skip = options?.skip ?? 0;

    const records = await this.taskDelegationModel
      .find({ delegatedBy: userIdObj })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return records.map((r) => ({
      _id: r._id.toString(),
      taskId: r.taskId.toString(),
      delegatedBy: r.delegatedBy.toString(),
      delegatedTo: r.delegatedTo.toString(),
      note: r.note,
      createdAt: r.createdAt?.toISOString?.() ?? '',
    }));
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  /**
   * Validates whether a delegation/reassignment target is eligible.
   *
   * Checks performed:
   * 1. **Self-delegation**: The delegator and target must be different users.
   * 2. **User exists**: The target must exist and not be deleted.
   * 3. **User role**: Only `MANAGER` and `ADMIN` users can be delegated to.
   * 4. **Outlet access**: If the task belongs to an outlet, the target must
   *    be a manager of that outlet or have it in their outlet list.
   *
   * @throws BadRequestException if validation fails.
   */
  private async validateDelegationTarget(
    task: Pick<TaskDocument, 'outletId'>,
    delegatedBy: Types.ObjectId,
    delegatedTo: Types.ObjectId,
  ): Promise<void> {
    // --------------------------------------------------
    // 1. Prevent self-delegation
    // --------------------------------------------------
    if (delegatedBy.toString() === delegatedTo.toString()) {
      throw new BadRequestException(
        'Cannot delegate a task to yourself',
      );
    }

    // --------------------------------------------------
    // 2. Validate target user exists
    // --------------------------------------------------
    const targetUser = await this.userModel
      .findOne({ _id: delegatedTo, isDeleted: false })
      .select('role outlets')
      .lean()
      .exec();

    if (!targetUser) {
      throw new BadRequestException('Target user not found');
    }

    // --------------------------------------------------
    // 3. Validate user role
    // --------------------------------------------------
    if (
      targetUser.role !== UserRole.MANAGER &&
      targetUser.role !== UserRole.ADMIN
    ) {
      throw new BadRequestException(
        'User must be a manager or admin to receive task delegation',
      );
    }

    // --------------------------------------------------
    // 4. Validate outlet access (if task belongs to an outlet)
    // --------------------------------------------------
    if (task.outletId) {
      await this.validateOutletAccess(
        delegatedTo,
        task.outletId,
        targetUser,
      );
    }
  }

  /**
   * Validates that a user has access to a specific outlet.
   *
   * A user has outlet access if:
   * - They are listed in the user's `outlets` array, OR
   * - They are listed in the outlet's `managerIds` array.
   *
   * @throws BadRequestException if the user does not have outlet access.
   */
  private async validateOutletAccess(
    userId: Types.ObjectId,
    outletId: Types.ObjectId,
    user: {
      outlets?: (string | Types.ObjectId)[];
      role?: string;
    },
  ): Promise<void> {
    // Admins have access to all outlets
    if (user.role === UserRole.ADMIN) {
      return;
    }

    // Check user's outlet list
    const userOutletIds = (user.outlets ?? []).map((id) => id.toString());
    if (userOutletIds.includes(outletId.toString())) {
      return;
    }

    // Check outlet's manager list
    const outlet = await this.outletModel
      .findOne({ _id: outletId, isDeleted: false })
      .select('managerIds')
      .lean()
      .exec();

    if (outlet) {
      const managerIds = (outlet.managerIds ?? []).map((id) =>
        id.toString(),
      );
      if (managerIds.includes(userId.toString())) {
        return;
      }
    }

    throw new BadRequestException(
      'User does not have access to the task outlet',
    );
  }
}
