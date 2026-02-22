import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { Outlet, OutletDocument } from './entities/outlet.entity';
import { QueryOutletDto } from './dto/query-outlet.dto';
import { generateOutletQrToken } from '../../util/outlet-qr-token.util';

@Injectable()
export class OutletService {
  constructor(
    @InjectModel(Outlet.name) private outletModel: Model<OutletDocument>,
  ) {}

  async create(createOutletDto: CreateOutletDto): Promise<Outlet> {
    const _id = new Types.ObjectId();
    const qrToken = generateOutletQrToken(_id.toString());
    const createdOutlet = new this.outletModel({
      ...createOutletDto,
      _id,
      qrToken,
    });
    return createdOutlet.save();
  }

  async findAll(query: QueryOutletDto) {
    const { page = 1, limit = 10, name, outletType } = query;
    const filter: Record<string, any> = { isDeleted: false };

    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (outletType) {
      filter.outletType = outletType;
    }

    const [data, total] = await Promise.all([
      this.outletModel
        .find(filter)
        .populate('managerId', 'name')
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.outletModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Outlet> {
    const outlet = await this.outletModel
      .findOne({ _id: id, isDeleted: false })
      .exec();
    if (!outlet) {
      throw new NotFoundException(`Outlet with ID ${id} not found`);
    }
    return outlet;
  }

  async update(id: string, updateOutletDto: UpdateOutletDto): Promise<Outlet> {
    const existingOutlet = await this.outletModel
      .findOneAndUpdate({ _id: id, isDeleted: false }, updateOutletDto, {
        new: true,
      })
      .exec();

    if (!existingOutlet) {
      throw new NotFoundException(`Outlet with ID ${id} not found`);
    }
    return existingOutlet;
  }

  async remove(id: string): Promise<Outlet> {
    const deletedOutlet = await this.outletModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { isDeleted: true },
        { new: true },
      )
      .exec();

    if (!deletedOutlet) {
      throw new NotFoundException(`Outlet with ID ${id} not found`);
    }
    return deletedOutlet;
  }
}
