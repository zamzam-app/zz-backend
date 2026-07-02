import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
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
      this.handleError(err, 'Failed to create cake customization option');
    }
  }

  async findAll(
    query: QueryCakeCustomizationOptionDto,
  ): Promise<FindAllCakeCustomizationOptionsResult> {
    if (
      (query.page !== undefined && query.page < 1) ||
      (query.limit !== undefined && query.limit < 1)
    ) {
      throw new BadRequestException('Page and limit must be positive values');
    }
    try {
      const page = query.page ?? 1;
      const limit = query.limit ? Math.min(query.limit, 100) : 100;
      const skip = (page - 1) * limit;

      const matchStage: Record<string, unknown> = { isDeleted: false };

      if (query.type && query.type.length > 0) {
        matchStage.type = { $in: query.type };
      }

      const dataPipeline: PipelineStage.FacetPipelineStage[] = [
        { $skip: skip },
        { $limit: limit },
      ];

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
    } catch (err) {
      this.handleError(err, 'Failed to fetch cake customization options');
    }
  }

  async findOne(id: string): Promise<CakeCustomizationOption> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
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
      this.handleError(err, 'Failed to fetch cake customization option');
    }
  }

  async update(
    id: string,
    updateDto: UpdateCakeCustomizationOptionDto,
  ): Promise<CakeCustomizationOption> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
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
      this.handleError(err, 'Failed to update cake customization option');
    }
  }

  async remove(id: string): Promise<CakeCustomizationOption> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
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
      this.handleError(err, 'Failed to remove cake customization option');
    }
  }

  private handleError(err: unknown, fallbackMessage: string): never {
    if (err instanceof HttpException) throw err;
    console.error(fallbackMessage, err);
    throw new InternalServerErrorException(fallbackMessage);
  }
}
