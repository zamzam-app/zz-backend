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
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(
    dto: CreateTaskDto,
    createdByUserId: string,
    jwtUser: JwtPayload,
  ): Promise<TaskBoardItem> {
    try {
      if (!Types.ObjectId.isValid(dto.outletId)) {
        throw new BadRequestException('Invalid outlet ID');
      }

      const outlet = await this.outletModel.findOne({
        _id: dto.outletId,
        isDeleted: false,
      });
      if (!outlet) {
        throw new NotFoundException('Outlet not found');
      }

      await this.assertManagerOutletAccess(jwtUser, dto.outletId);

      const assigneeIds = dto.assigneeIds ?? [];
      await this.assertAssigneesAllowed(outlet, assigneeIds);

      const status = dto.status ?? TaskStatus.OPEN;
      const completedAt = status === TASK_STATUS_COMPLETED ? new Date() : null;

      const doc = new this.taskModel({
        description: dto.description.trim(),
        category: dto.category,
        priority: dto.priority ?? undefined,
        status,
        dueDate: new Date(dto.dueDate),
        outletId: new Types.ObjectId(dto.outletId),
        assigneeIds: assigneeIds.map((id) => new Types.ObjectId(id)),
        createdBy: new Types.ObjectId(createdByUserId),
        imageUrls: dto.imageUrls ?? [],
        videoUrls: dto.videoUrls ?? [],
        completedAt,
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

      const outletIdStr = existing.outletId.toString();
      await this.assertManagerOutletAccess(jwtUser, outletIdStr);

      const outlet = await this.outletModel.findOne({
        _id: outletIdStr,
        isDeleted: false,
      });
      if (!outlet) {
        throw new NotFoundException('Outlet not found');
      }

      if (dto.assigneeIds !== undefined) {
        await this.assertAssigneesAllowed(outlet, dto.assigneeIds);
      }

      const $set: Record<string, unknown> = {};

      if (dto.description !== undefined) {
        $set.description = dto.description.trim();
      }
      if (dto.category !== undefined) $set.category = dto.category;
      if (dto.priority !== undefined) $set.priority = dto.priority;
      if (dto.dueDate !== undefined) $set.dueDate = new Date(dto.dueDate);
      if (dto.imageUrls !== undefined) $set.imageUrls = dto.imageUrls;
      if (dto.videoUrls !== undefined) $set.videoUrls = dto.videoUrls;

      if (dto.assigneeIds !== undefined) {
        $set.assigneeIds = dto.assigneeIds.map((id) => new Types.ObjectId(id));
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
      if (allowed.length === 0) {
        matchStage.outletId = { $in: [] };
      } else {
        matchStage.outletId = { $in: allowed };
      }
    }

    if (query.status) {
      matchStage.status = query.status;
    }
    if (query.category) {
      matchStage.category = query.category;
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
    const outlets = user?.outlets ?? [];
    return outlets.map((o) => new Types.ObjectId(o.toString()));
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
    const allowed = (user.outlets ?? []).map((o) => o.toString());
    if (!allowed.includes(outletId)) {
      throw new ForbiddenException('You do not have access to this outlet');
    }
  }

  private async assertAssigneesAllowed(
    outlet: OutletDocument,
    assigneeIds: string[],
  ): Promise<void> {
    if (assigneeIds.length === 0) {
      return;
    }

    const managerIdSet = new Set(
      (outlet.managerIds ?? []).map((id) => id.toString()),
    );

    for (const aid of assigneeIds) {
      if (!Types.ObjectId.isValid(aid)) {
        throw new BadRequestException(`Invalid assignee ID: ${aid}`);
      }
      if (!managerIdSet.has(aid)) {
        throw new BadRequestException(
          'Assignees must be managers of the selected outlet',
        );
      }

      const user = await this.userModel
        .findOne({ _id: aid, isDeleted: false })
        .lean()
        .exec();
      if (!user) {
        throw new BadRequestException(`Assignee not found: ${aid}`);
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
          outlet: { $arrayElemAt: ['$outletArr', 0] },
          createdBy: { $arrayElemAt: ['$creatorArr', 0] },
        },
      },
      {
        $project: {
          outletArr: 0,
          creatorArr: 0,
          outletId: 0,
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
      .select('outletId')
      .lean()
      .exec();
    if (!task) {
      return null;
    }

    await this.assertManagerOutletAccess(jwtUser, task.outletId.toString());

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
