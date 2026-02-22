import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateOutletTypeDto } from './dto/create-outlet-type.dto';
import { UpdateOutletTypeDto } from './dto/update-outlet-type.dto';
import { InjectModel } from '@nestjs/mongoose';
import { OutletType, OutletTypeDocument } from './entities/outlet-type.entity';
import { Model, Types } from 'mongoose';
import { QueryOutletTypeDto } from './dto/query-outlet-type.dto';
import { FindAllOutletTypesResult } from './interface/query-outlet-type.interface';

@Injectable()
export class OutletTypeService {
  constructor(
    @InjectModel(OutletType.name)
    private outletTypeModel: Model<OutletTypeDocument>,
  ) {}

  async create(createOutletTypeDto: CreateOutletTypeDto): Promise<OutletType> {
    const createdOutletType = new this.outletTypeModel(createOutletTypeDto);
    return createdOutletType.save();
  }

  async findAll(query: QueryOutletTypeDto): Promise<FindAllOutletTypesResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const dataPipeline = limit ? [{ $skip: skip }, { $limit: limit }] : [];

      const [result] = await this.outletTypeModel
        .aggregate<{
          data: OutletType[];
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
        err instanceof Error ? err.message : 'Failed to fetch outlet types',
      );
    }
  }

  async findOne(id: string): Promise<OutletType> {
    const outletType = await this.outletTypeModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .exec();
    if (!outletType) {
      throw new NotFoundException(`Outlet type with ID ${id} not found`);
    }
    return outletType;
  }

  async update(
    id: string,
    updateOutletTypeDto: UpdateOutletTypeDto,
  ): Promise<OutletType> {
    const updatedOutletType = await this.outletTypeModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        updateOutletTypeDto,
        { new: true },
      )
      .exec();
    if (!updatedOutletType) {
      throw new NotFoundException(`Outlet type with ID ${id} not found`);
    }
    return updatedOutletType;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.outletTypeModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        { isDeleted: true },
      )
      .exec();
    if (!result) {
      throw new NotFoundException(`Outlet type with ID ${id} not found`);
    }
    return { message: 'Outlet type deleted successfully' };
  }
}
