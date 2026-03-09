import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category, CategoryDocument } from './entities/category.entity';
import { FindAllCategoriesResult } from './interfaces/query-category.interface';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    try {
      const createdCategory = new this.categoryModel(createCategoryDto);
      return await createdCategory.save();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to create category',
      );
    }
  }

  async findAll(query: QueryCategoryDto): Promise<FindAllCategoriesResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const dataPipeline = limit ? [{ $skip: skip }, { $limit: limit }] : [];

      const [result] = await this.categoryModel
        .aggregate<{
          data: Category[];
          totalCount: [{ count: number }];
        }>([
          { $match: { isDeleted: false } },
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
        err instanceof Error ? err.message : 'Failed to fetch categories',
      );
    }
  }

  async findOne(id: string): Promise<Category> {
    try {
      const [category] = await this.categoryModel
        .aggregate<Category>([
          { $match: { _id: new Types.ObjectId(id), isDeleted: false } },
          { $limit: 1 },
        ])
        .exec();
      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      return category;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to fetch category',
      );
    }
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    try {
      const existingCategory = await this.categoryModel
        .findOneAndUpdate(
          { _id: new Types.ObjectId(id), isDeleted: false },
          [{ $set: updateCategoryDto as Record<string, unknown> }],
          { new: true, updatePipeline: true },
        )
        .exec();

      if (!existingCategory) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      return existingCategory;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to update category',
      );
    }
  }

  async remove(id: string): Promise<Category> {
    try {
      const deletedCategory = await this.categoryModel
        .findOneAndUpdate(
          { _id: id, isDeleted: false },
          { isDeleted: true },
          { new: true },
        )
        .exec();

      if (!deletedCategory) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      return deletedCategory;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to remove category',
      );
    }
  }
}
