import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTaskCategoryDto } from './dto/create-task-category.dto';
import { QueryTaskCategoryDto } from './dto/query-task-category.dto';
import { UpdateTaskCategoryDto } from './dto/update-task-category.dto';
import {
  TaskCategory,
  TaskCategoryDocument,
} from './entities/task-category.entity';
import { FindAllTaskCategoriesResult } from './interfaces/query-task-category.interface';

@Injectable()
export class TaskCategoryService {
  constructor(
    @InjectModel(TaskCategory.name)
    private taskCategoryModel: Model<TaskCategoryDocument>,
  ) {}

  async create(dto: CreateTaskCategoryDto): Promise<TaskCategory> {
    try {
      const created = new this.taskCategoryModel({
        ...dto,
        name: dto.name.trim(),
        description: dto.description?.trim(),
      });
      return await created.save();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to create task category',
      );
    }
  }

  async findAll(
    query: QueryTaskCategoryDto,
  ): Promise<FindAllTaskCategoriesResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const dataPipeline = limit ? [{ $skip: skip }, { $limit: limit }] : [];

      const [result] = await this.taskCategoryModel
        .aggregate<{
          data: TaskCategory[];
          totalCount: [{ count: number }];
        }>([
          { $match: { isDeleted: false } },
          { $sort: { name: 1, createdAt: -1 } },
          {
            $facet: {
              data: dataPipeline,
              totalCount: [{ $count: 'count' }],
            },
          },
        ])
        .exec();

      const total = result.totalCount[0]?.count ?? 0;
      const effectiveLimit = limit ?? total;

      return {
        data: result.data,
        meta: {
          total,
          currentPage: limit ? page : 1,
          hasPrevPage: limit ? page > 1 : false,
          hasNextPage: limit ? page * limit < total : false,
          limit: effectiveLimit,
        },
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to fetch task categories',
      );
    }
  }

  async findOne(id: string): Promise<TaskCategory> {
    try {
      const [taskCategory] = await this.taskCategoryModel
        .aggregate<TaskCategory>([
          { $match: { _id: new Types.ObjectId(id), isDeleted: false } },
          { $limit: 1 },
        ])
        .exec();

      if (!taskCategory) {
        throw new NotFoundException(`Task category with ID ${id} not found`);
      }

      return taskCategory;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to fetch task category',
      );
    }
  }

  async update(id: string, dto: UpdateTaskCategoryDto): Promise<TaskCategory> {
    try {
      const setPayload: Record<string, unknown> = { ...dto };
      if (dto.name !== undefined) {
        setPayload.name = dto.name.trim();
      }
      if (dto.description !== undefined) {
        setPayload.description = dto.description?.trim();
      }

      const existingTaskCategory = await this.taskCategoryModel
        .findOneAndUpdate(
          { _id: new Types.ObjectId(id), isDeleted: false },
          [{ $set: setPayload }],
          { new: true, updatePipeline: true },
        )
        .exec();

      if (!existingTaskCategory) {
        throw new NotFoundException(`Task category with ID ${id} not found`);
      }

      return existingTaskCategory;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to update task category',
      );
    }
  }

  async remove(id: string): Promise<TaskCategory> {
    try {
      const deletedTaskCategory = await this.taskCategoryModel
        .findOneAndUpdate(
          { _id: id, isDeleted: false },
          { isDeleted: true, isActive: false },
          { new: true },
        )
        .exec();

      if (!deletedTaskCategory) {
        throw new NotFoundException(`Task category with ID ${id} not found`);
      }

      return deletedTaskCategory;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to remove task category',
      );
    }
  }
}
