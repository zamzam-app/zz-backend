import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOutletTableDto } from './dto/create-outlet-table.dto';
import { UpdateOutletTableDto } from './dto/update-outlet-table.dto';
import {
  OutletTable,
  OutletTableDocument,
} from './entities/outlet-table.entity';
import { Outlet, OutletDocument } from '../outlet/entities/outlet.entity';
import { generateOutletQrToken } from '../../util/outlet-qr-token.util';
import { QueryOutletTableDto } from './dto/query-outlet-table.dto';
import { FindAllOutletTablesResult } from './interfaces/query-outlet-table.interface';

@Injectable()
export class OutletTableService {
  constructor(
    @InjectModel(OutletTable.name)
    private outletTableModel: Model<OutletTableDocument>,
    @InjectModel(Outlet.name)
    private outletModel: Model<OutletDocument>,
  ) {}

  async create(
    createOutletTableDto: CreateOutletTableDto,
  ): Promise<OutletTable> {
    try {
      const outletExists = await this.outletModel
        .findOne({
          _id: createOutletTableDto.outletId,
          isDeleted: false,
        })
        .lean()
        .exec();

      if (!outletExists) {
        throw new NotFoundException(
          `Outlet with ID ${createOutletTableDto.outletId} not found`,
        );
      }

      const _id = new Types.ObjectId();
      const tableToken = generateOutletQrToken(_id.toString());

      const createdOutletTable = new this.outletTableModel({
        ...createOutletTableDto,
        _id,
        tableToken,
      });
      const saved = await createdOutletTable.save();

      await this.outletModel
        .updateOne(
          { _id: createOutletTableDto.outletId, isDeleted: false },
          { $addToSet: { tableIds: saved._id } },
        )
        .exec();

      return saved;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new BadRequestException(
          'A table with the same name already exists in this outlet',
        );
      }
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to create outlet table',
      );
    }
  }

  async findAll(
    query: QueryOutletTableDto,
  ): Promise<FindAllOutletTablesResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const matchStage: Record<string, unknown> = { isDeleted: false };
      if (query.outletId) {
        matchStage.outletId = new Types.ObjectId(query.outletId);
      }
      if (query.status) {
        matchStage.status = query.status;
      }
      if (query.name) {
        matchStage.name = { $regex: query.name, $options: 'i' };
      }

      const dataPipeline = [
        { $sort: { createdAt: -1 as const } },
        ...(limit ? [{ $skip: skip }, { $limit: limit }] : []),
      ];

      const [result] = await this.outletTableModel
        .aggregate<{
          data: OutletTable[];
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
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to retrieve outlet tables',
      );
    }
  }

  async findOne(id: string): Promise<OutletTable> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid outlet table ID');
      }

      const outletTable = await this.outletTableModel
        .findOne({ _id: id, isDeleted: false })
        .exec();

      if (!outletTable) {
        throw new NotFoundException(`Outlet table with ID ${id} not found`);
      }

      return outletTable;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to retrieve outlet table',
      );
    }
  }

  async update(
    id: string,
    updateOutletTableDto: UpdateOutletTableDto,
  ): Promise<OutletTable> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid outlet table ID');
      }

      const updatedOutletTable = await this.outletTableModel
        .findOneAndUpdate({ _id: id, isDeleted: false }, updateOutletTableDto, {
          new: true,
        })
        .exec();

      if (!updatedOutletTable) {
        throw new NotFoundException(`Outlet table with ID ${id} not found`);
      }

      return updatedOutletTable;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new BadRequestException(
          'A table with the same name already exists in this outlet',
        );
      }
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to update outlet table',
      );
    }
  }

  async remove(id: string): Promise<OutletTable> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid outlet table ID');
      }

      const removedOutletTable = await this.outletTableModel
        .findOneAndUpdate(
          { _id: id, isDeleted: false },
          { isDeleted: true, isActive: false },
          { new: true },
        )
        .exec();

      if (!removedOutletTable) {
        throw new NotFoundException(`Outlet table with ID ${id} not found`);
      }

      await this.outletModel
        .updateOne(
          { _id: removedOutletTable.outletId, isDeleted: false },
          { $pull: { tableIds: removedOutletTable._id } },
        )
        .exec();

      return removedOutletTable;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to remove outlet table',
      );
    }
  }
}
