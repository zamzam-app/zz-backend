import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { JwtPayload } from '../auth/interfaces/auth.interfaces';
import { UserRole } from '../users/interfaces/user.interface';
import { Outlet, OutletDocument } from '../outlet/entities/outlet.entity';
import {
  TaskCategory,
  TaskCategoryDocument,
} from '../task-category/entities/task-category.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { Task, TaskDocument } from './entities/task.entity';
import { TaskStatus } from './task.enums';
import {
  FindAllTasksResult,
  TaskBoardItem,
} from './interfaces/query-task.interface';

const TASK_STATUS_COMPLETED = TaskStatus.COMPLETED;

@Injectable()
export class TaskService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Outlet.name) private outletModel: Model<OutletDocument>,
    @InjectModel(TaskCategory.name)
    private taskCategoryModel: Model<TaskCategoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(
    dto: CreateTaskDto,
    createdByUserId: string,
    jwtUser: JwtPayload,
  ): Promise<TaskBoardItem> {
    try {
      let outlet: OutletDocument | null = null;
      if (dto.outletId) {
        if (!Types.ObjectId.isValid(dto.outletId)) {
          throw new BadRequestException('Invalid outlet ID');
        }

        outlet = await this.outletModel.findOne({
          _id: dto.outletId,
          isDeleted: false,
        });
        if (!outlet) {
          throw new NotFoundException('Outlet not found');
        }

        await this.assertManagerOutletAccess(jwtUser, dto.outletId);
      }

      await this.assertTaskCategoryExists(dto.taskCategoryId);

      const assigneeIds = dto.assigneeIds ?? [];
      await this.assertAssigneesAllowed(outlet, assigneeIds);

      const status = dto.status ?? TaskStatus.OPEN;
      const completedAt = status === TASK_STATUS_COMPLETED ? new Date() : null;

      const doc = new this.taskModel({
        description: dto.description.trim(),
        taskCategoryId: new Types.ObjectId(dto.taskCategoryId),
        priority: dto.priority ?? undefined,
        status,
        dueDate: new Date(dto.dueDate),
        outletId: dto.outletId ? new Types.ObjectId(dto.outletId) : null,
        assigneeIds: assigneeIds.map((id) => new Types.ObjectId(id)),
        createdBy: new Types.ObjectId(createdByUserId),
        completedAt,
        adminSubmission: dto.adminSubmission
          ? {
              ...dto.adminSubmission,
              createdBy: new Types.ObjectId(createdByUserId),
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : undefined,
        managerSubmission: dto.managerSubmission
          ? {
              ...dto.managerSubmission,
              createdBy: new Types.ObjectId(createdByUserId),
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : undefined,
      });

      const saved = await doc.save();
      const one = await this.findOneTaskById(saved._id.toString(), jwtUser);
      if (!one) {
        throw new InternalServerErrorException('Failed to load created task');
      }
      return one;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to create task',
      );
    }
  }

  async findAll(
    query: QueryTaskDto,
    jwtUser: JwtPayload,
  ): Promise<FindAllTasksResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const skip = (page - 1) * limit;

      const matchStage = await this.buildListMatchStage(query, jwtUser);

      const lookupStages = this.taskLookupStages();

      const sortStages: PipelineStage[] = [
        {
          $addFields: {
            _completedSort: {
              $cond: [{ $eq: ['$status', TASK_STATUS_COMPLETED] }, 1, 0],
            },
          },
        },
        { $sort: { _completedSort: 1, dueDate: 1, createdAt: -1 } },
        { $project: { _completedSort: 0 } },
      ];

      const dataPipeline: PipelineStage[] = [
        ...sortStages,
        ...lookupStages,
        { $skip: skip },
        { $limit: limit },
      ];

      const [result] = await this.taskModel
        .aggregate<{
          data: TaskBoardItem[];
          totalCount: [{ count: number }];
        }>([
          { $match: matchStage },
          {
            $facet: {
              data: dataPipeline as PipelineStage.FacetPipelineStage[],
              totalCount: [{ $count: 'count' }],
            },
          },
        ])
        .exec();

      const total = result.totalCount[0]?.count ?? 0;
      return {
        data: result.data,
        meta: {
          total,
          currentPage: page,
          hasPrevPage: page > 1,
          hasNextPage: page * limit < total,
          limit,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch tasks',
      );
    }
  }

  async findOne(id: string, jwtUser: JwtPayload): Promise<TaskBoardItem> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid task ID');
      }

      const task = await this.findOneTaskById(id, jwtUser);
      if (!task) {
        throw new NotFoundException('Task not found');
      }
      return task;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to fetch task',
      );
    }
  }

  async update(
    id: string,
    dto: UpdateTaskDto,
    jwtUser: JwtPayload,
  ): Promise<TaskBoardItem> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid task ID');
      }

      const existing = await this.taskModel.findOne({
        _id: id,
        isDeleted: false,
      });
      if (!existing) {
        throw new NotFoundException('Task not found');
      }

      if (existing.outletId) {
        await this.assertManagerOutletAccess(
          jwtUser,
          existing.outletId.toString(),
        );
      }

      let outlet: OutletDocument | null = null;
      const outletId =
        dto.outletId !== undefined ? dto.outletId : existing.outletId;

      if (outletId) {
        outlet = await this.outletModel.findOne({
          _id: outletId,
          isDeleted: false,
        });
        if (!outlet) {
          throw new NotFoundException('Outlet not found');
        }
        if (dto.outletId) {
          await this.assertManagerOutletAccess(
            jwtUser,
            dto.outletId.toString(),
          );
        }
      }

      if (dto.assigneeIds !== undefined) {
        await this.assertAssigneesAllowed(outlet, dto.assigneeIds);
      }

      const $set: Record<string, unknown> = {};

      if (dto.description !== undefined) {
        $set.description = dto.description.trim();
      }
      if (dto.taskCategoryId !== undefined) {
        await this.assertTaskCategoryExists(dto.taskCategoryId);
        $set.taskCategoryId = new Types.ObjectId(dto.taskCategoryId);
      }
      if (dto.priority !== undefined) $set.priority = dto.priority;
      if (dto.dueDate !== undefined) $set.dueDate = new Date(dto.dueDate);
      if (dto.outletId !== undefined) {
        $set.outletId = dto.outletId ? new Types.ObjectId(dto.outletId) : null;
      }

      if (dto.assigneeIds !== undefined) {
        $set.assigneeIds = dto.assigneeIds.map((id) => new Types.ObjectId(id));
      }

      if (dto.adminSubmission !== undefined) {
        const adminSub = dto.adminSubmission;
        if (adminSub.text !== undefined) {
          $set['adminSubmission.text'] = adminSub.text;
        }
        if (adminSub.attachments !== undefined) {
          if (adminSub.attachments.images !== undefined) {
            $set['adminSubmission.attachments.images'] =
              adminSub.attachments.images;
          }
          if (adminSub.attachments.videos !== undefined) {
            $set['adminSubmission.attachments.videos'] =
              adminSub.attachments.videos;
          }
          if (adminSub.attachments.audios !== undefined) {
            $set['adminSubmission.attachments.audios'] =
              adminSub.attachments.audios;
          }
          if (adminSub.attachments.files !== undefined) {
            $set['adminSubmission.attachments.files'] =
              adminSub.attachments.files;
          }
        }
        $set['adminSubmission.createdBy'] = new Types.ObjectId(jwtUser.sub);
        $set['adminSubmission.updatedAt'] = new Date();
        if (!existing.adminSubmission) {
          $set['adminSubmission.createdAt'] = new Date();
        }
      }
      if (dto.managerSubmission !== undefined) {
        const managerSub = dto.managerSubmission;
        if (managerSub.text !== undefined) {
          $set['managerSubmission.text'] = managerSub.text;
        }
        if (managerSub.attachments !== undefined) {
          if (managerSub.attachments.images !== undefined) {
            $set['managerSubmission.attachments.images'] =
              managerSub.attachments.images;
          }
          if (managerSub.attachments.videos !== undefined) {
            $set['managerSubmission.attachments.videos'] =
              managerSub.attachments.videos;
          }
          if (managerSub.attachments.audios !== undefined) {
            $set['managerSubmission.attachments.audios'] =
              managerSub.attachments.audios;
          }
          if (managerSub.attachments.files !== undefined) {
            $set['managerSubmission.attachments.files'] =
              managerSub.attachments.files;
          }
        }
        $set['managerSubmission.createdBy'] = new Types.ObjectId(jwtUser.sub);
        $set['managerSubmission.updatedAt'] = new Date();
        if (!existing.managerSubmission) {
          $set['managerSubmission.createdAt'] = new Date();
        }
      }

      let nextStatus = existing.status;
      if (dto.status !== undefined) {
        $set.status = dto.status;
        nextStatus = dto.status;
        $set.completedAt =
          nextStatus === TASK_STATUS_COMPLETED ? new Date() : null;
      }

      if (Object.keys($set).length === 0) {
        const current = await this.findOneTaskById(id, jwtUser);
        if (!current) {
          throw new NotFoundException('Task not found');
        }
        return current;
      }

      await this.taskModel
        .updateOne({ _id: id, isDeleted: false }, { $set })
        .exec();

      const updated = await this.findOneTaskById(id, jwtUser);
      if (!updated) {
        throw new NotFoundException('Task not found');
      }
      return updated;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to update task',
      );
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateTaskStatusDto,
    jwtUser: JwtPayload,
  ): Promise<TaskBoardItem> {
    return this.update(id, { status: dto.status }, jwtUser);
  }

  async findByAssignee(
    userId: string,
    query: QueryTaskDto,
    jwtUser: JwtPayload,
  ): Promise<FindAllTasksResult> {
    if (jwtUser.role === UserRole.MANAGER && jwtUser.sub !== userId) {
      throw new ForbiddenException('You can only view your own tasks');
    }

    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const modifiedQuery = { ...query, assigneeId: userId };
    return this.findAll(modifiedQuery, jwtUser);
  }

  async remove(id: string, jwtUser: JwtPayload): Promise<TaskBoardItem> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid task ID');
      }

      const snapshot = await this.findOneTaskById(id, jwtUser);
      if (!snapshot) {
        throw new NotFoundException('Task not found');
      }

      await this.taskModel
        .updateOne(
          { _id: id, isDeleted: false },
          { $set: { isDeleted: true, isActive: false } },
        )
        .exec();

      return snapshot;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'Failed to delete task',
      );
    }
  }

  private async buildListMatchStage(
    query: QueryTaskDto,
    jwtUser: JwtPayload,
  ): Promise<Record<string, unknown>> {
    const matchStage: Record<string, unknown> = { isDeleted: false };

    if (query.outletId) {
      if (!Types.ObjectId.isValid(query.outletId)) {
        throw new BadRequestException('Invalid outlet ID filter');
      }
      await this.assertManagerOutletAccess(jwtUser, query.outletId);
      matchStage.outletId = new Types.ObjectId(query.outletId);
    } else if (jwtUser.role === UserRole.MANAGER) {
      const allowed = await this.managerOutletObjectIds(jwtUser.sub);
      const managerDefaultFilters = [
        { outletId: { $in: allowed } },
        { assigneeIds: new Types.ObjectId(jwtUser.sub) },
        { createdBy: new Types.ObjectId(jwtUser.sub) },
      ];

      if (matchStage.assigneeIds) {
        matchStage.$and = [
          { $or: managerDefaultFilters },
          { assigneeIds: matchStage.assigneeIds },
        ];
        delete matchStage.assigneeIds;
      } else {
        matchStage.$or = managerDefaultFilters;
      }
    }

    if (query.status) {
      matchStage.status = query.status;
    }
    if (query.taskCategoryId) {
      if (!Types.ObjectId.isValid(query.taskCategoryId)) {
        throw new BadRequestException('Invalid task category ID filter');
      }
      matchStage.taskCategoryId = new Types.ObjectId(query.taskCategoryId);
    }
    if (query.priority) {
      matchStage.priority = query.priority;
    }
    if (query.assigneeId) {
      if (!Types.ObjectId.isValid(query.assigneeId)) {
        throw new BadRequestException('Invalid assignee ID filter');
      }
      matchStage.assigneeIds = new Types.ObjectId(query.assigneeId);
    }

    if (query.search?.trim()) {
      matchStage.description = {
        $regex: query.search.trim(),
        $options: 'i',
      };
    }

    const dueDateCond: Record<string, Date> = {};
    if (query.dueFrom) {
      dueDateCond.$gte = new Date(query.dueFrom);
    }
    if (query.dueTo) {
      dueDateCond.$lte = new Date(query.dueTo);
    }
    if (Object.keys(dueDateCond).length > 0) {
      matchStage.dueDate = dueDateCond;
    }

    return matchStage;
  }

  private async managerOutletObjectIds(
    userId: string,
  ): Promise<Types.ObjectId[]> {
    const user = await this.userModel
      .findById(userId)
      .select('outlets')
      .lean()
      .exec();
    const fromProfile = (user?.outlets ?? []).map(
      (o) => new Types.ObjectId(o.toString()),
    );

    const fromOutletDocs = await this.outletModel
      .find({
        isDeleted: false,
        managerIds: new Types.ObjectId(userId),
      } as Record<string, unknown>)
      .select('_id')
      .lean()
      .exec();

    const fromManagerRole = fromOutletDocs.map((o) => o._id);

    const merged = new Map<string, Types.ObjectId>();
    for (const id of [...fromProfile, ...fromManagerRole]) {
      merged.set(id.toString(), id);
    }
    return [...merged.values()];
  }

  private async assertManagerOutletAccess(
    jwtUser: JwtPayload,
    outletId: string,
  ): Promise<void> {
    if (jwtUser.role !== UserRole.MANAGER) {
      return;
    }
    const user = await this.userModel.findById(jwtUser.sub).lean().exec();
    if (!user) {
      throw new ForbiddenException('User not found');
    }
    const fromProfile = (user.outlets ?? []).map((o) => o.toString());
    if (fromProfile.includes(outletId)) {
      return;
    }
    const outlet = await this.outletModel
      .findOne({
        _id: outletId,
        isDeleted: false,
        managerIds: new Types.ObjectId(jwtUser.sub),
      } as Record<string, unknown>)
      .select('_id')
      .lean()
      .exec();
    if (!outlet) {
      throw new ForbiddenException('You do not have access to this outlet');
    }
  }

  private async assertAssigneesAllowed(
    outlet: OutletDocument | null,
    assigneeIds: string[],
  ): Promise<void> {
    if (assigneeIds.length === 0) {
      return;
    }

    const managerIdSet = outlet
      ? new Set((outlet.managerIds ?? []).map((id) => id.toString()))
      : null;

    for (const aid of assigneeIds) {
      if (!Types.ObjectId.isValid(aid)) {
        throw new BadRequestException(`Invalid assignee ID: ${aid}`);
      }

      const user = await this.userModel
        .findOne({ _id: aid, isDeleted: false })
        .lean()
        .exec();
      if (!user) {
        throw new BadRequestException(`Assignee not found: ${aid}`);
      }

      if (user.role !== UserRole.MANAGER && user.role !== UserRole.ADMIN) {
        throw new BadRequestException(`Assignee ${aid} must be a manager`);
      }

      if (outlet && managerIdSet) {
        if (!managerIdSet.has(aid)) {
          throw new BadRequestException(
            'Assignees must be managers of the selected outlet',
          );
        }

        const userOutlets = (user.outlets ?? []).map((o) => o.toString());
        if (
          userOutlets.length > 0 &&
          !userOutlets.includes(outlet._id.toString())
        ) {
          throw new BadRequestException(
            `Assignee ${aid} is not linked to this outlet`,
          );
        }
      }
    }
  }

  private async assertTaskCategoryExists(
    taskCategoryId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(taskCategoryId)) {
      throw new BadRequestException('Invalid task category ID');
    }
    const taskCategory = await this.taskCategoryModel
      .findOne({ _id: taskCategoryId, isDeleted: false })
      .select('_id')
      .lean()
      .exec();
    if (!taskCategory) {
      throw new NotFoundException('Task category not found');
    }
  }

  private taskLookupStages(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'outlets',
          let: { oid: '$outletId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$oid'] } } },
            { $project: { _id: 1, name: 1 } },
          ],
          as: 'outletArr',
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { cid: '$adminSubmission.createdBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$cid'] } } },
            { $project: { _id: 1, name: 1 } },
          ],
          as: 'adminSubmissionCreator',
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { cid: '$managerSubmission.createdBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$cid'] } } },
            { $project: { _id: 1, name: 1 } },
          ],
          as: 'managerSubmissionCreator',
        },
      },
      {
        $lookup: {
          from: 'taskcategories',
          let: { tcid: '$taskCategoryId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$tcid'] } } },
            { $project: { _id: 1, name: 1, description: 1 } },
          ],
          as: 'taskCategoryArr',
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { aids: '$assigneeIds' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$_id', { $ifNull: ['$$aids', []] }],
                },
              },
            },
            { $project: { _id: 1, name: 1 } },
          ],
          as: 'assignees',
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { cid: '$createdBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$cid'] } } },
            { $project: { _id: 1, name: 1 } },
          ],
          as: 'creatorArr',
        },
      },
      {
        $addFields: {
          outlet: {
            $ifNull: [{ $arrayElemAt: ['$outletArr', 0] }, null],
          },
          taskCategory: { $arrayElemAt: ['$taskCategoryArr', 0] },
          createdBy: { $arrayElemAt: ['$creatorArr', 0] },
          'adminSubmission.createdBy': {
            $arrayElemAt: ['$adminSubmissionCreator', 0],
          },
          'managerSubmission.createdBy': {
            $arrayElemAt: ['$managerSubmissionCreator', 0],
          },
        },
      },
      {
        $project: {
          outletArr: 0,
          taskCategoryArr: 0,
          creatorArr: 0,
          adminSubmissionCreator: 0,
          managerSubmissionCreator: 0,
          outletId: 0,
          taskCategoryId: 0,
          assigneeIds: 0,
        },
      },
    ];
  }

  private async findOneTaskById(
    id: string,
    jwtUser: JwtPayload,
  ): Promise<TaskBoardItem | null> {
    const task = await this.taskModel
      .findOne({ _id: id, isDeleted: false })
      .select('outletId assigneeIds createdBy')
      .lean()
      .exec();
    if (!task) {
      return null;
    }

    if (task.outletId) {
      await this.assertManagerOutletAccess(jwtUser, task.outletId.toString());
    } else if (jwtUser.role === UserRole.MANAGER) {
      const isAssignee = (task.assigneeIds ?? [])
        .map((aid) => aid.toString())
        .includes(jwtUser.sub);
      const isCreator = task.createdBy.toString() === jwtUser.sub;

      if (!isAssignee && !isCreator) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    const pipeline: PipelineStage[] = [
      {
        $match: {
          _id: new Types.ObjectId(id),
          isDeleted: false,
        },
      },
      ...this.taskLookupStages(),
      { $limit: 1 },
    ];

    const [raw] = await this.taskModel
      .aggregate<TaskBoardItem>(pipeline)
      .exec();

    return raw ?? null;
  }
}
