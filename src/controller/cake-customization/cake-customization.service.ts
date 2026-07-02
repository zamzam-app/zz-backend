import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { CreateCakeCustomizationOptionDto } from './dto/create-cake-customization-option.dto';
import { QueryCakeCustomizationOptionDto } from './dto/query-cake-customization-option.dto';
import { UpdateCakeCustomizationOptionDto } from './dto/update-cake-customization-option.dto';
import {
  CakeCustomizationOption,
  CakeCustomizationOptionDocument,
} from './entities/cake-customization-option.entity';
import { FindAllCakeCustomizationOptionsResult } from './interfaces/query-cake-customization-option.interface';

@Injectable()
export class CakeCustomizationService {
  constructor(
    @InjectModel(CakeCustomizationOption.name)
    private optionModel: Model<CakeCustomizationOptionDocument>,
  ) {}

  async create(
    createDto: CreateCakeCustomizationOptionDto,
  ): Promise<CakeCustomizationOption> {
    try {
      const createdOption = new this.optionModel(createDto);
      return await createdOption.save();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error
          ? err.message
          : 'Failed to create cake customization option',
      );
    }
  }

  async findAll(
    query: QueryCakeCustomizationOptionDto,
  ): Promise<FindAllCakeCustomizationOptionsResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const matchStage: Record<string, unknown> = { isDeleted: false };

      if (query.type && query.type.length > 0) {
        matchStage.type = { $in: query.type };
      }

      const dataPipeline: PipelineStage.FacetPipelineStage[] = limit
        ? [{ $skip: skip }, { $limit: limit }]
        : [];

      const [result] = await this.optionModel
        .aggregate<{
          data: CakeCustomizationOption[];
          totalCount: [{ count: number }];
        }>([
          { $match: matchStage },
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
        err instanceof Error
          ? err.message
          : 'Failed to fetch cake customization options',
      );
    }
  }

  async findOne(id: string): Promise<CakeCustomizationOption> {
    try {
      const [option] = await this.optionModel
        .aggregate<CakeCustomizationOption>([
          { $match: { _id: new Types.ObjectId(id), isDeleted: false } },
          { $limit: 1 },
        ])
        .exec();
      if (!option) {
        throw new NotFoundException(
          `Cake customization option with ID ${id} not found`,
        );
      }
      return option;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error
          ? err.message
          : 'Failed to fetch cake customization option',
      );
    }
  }

  async update(
    id: string,
    updateDto: UpdateCakeCustomizationOptionDto,
  ): Promise<CakeCustomizationOption> {
    try {
      const existingOption = await this.optionModel
        .findOneAndUpdate(
          { _id: new Types.ObjectId(id), isDeleted: false },
          [{ $set: updateDto as Record<string, unknown> }],
          { new: true, updatePipeline: true },
        )
        .exec();

      if (!existingOption) {
        throw new NotFoundException(
          `Cake customization option with ID ${id} not found`,
        );
      }
      return existingOption;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error
          ? err.message
          : 'Failed to update cake customization option',
      );
    }
  }

  async remove(id: string): Promise<CakeCustomizationOption> {
    try {
      const deletedOption = await this.optionModel
        .findOneAndUpdate(
          { _id: id, isDeleted: false },
          { isDeleted: true },
          { new: true },
        )
        .exec();

      if (!deletedOption) {
        throw new NotFoundException(
          `Cake customization option with ID ${id} not found`,
        );
      }
      return deletedOption;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error
          ? err.message
          : 'Failed to remove cake customization option',
      );
    }
  }
}
