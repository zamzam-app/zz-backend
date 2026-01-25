import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { Outlet, OutletDocument } from './entities/outlet.entity';
import { QueryOutletDto } from './dto/query-outlet.dto';

@Injectable()
export class OutletService {
  constructor(
    @InjectModel(Outlet.name) private outletModel: Model<OutletDocument>,
  ) {}

  async create(createOutletDto: CreateOutletDto): Promise<Outlet> {
    const createdOutlet = new this.outletModel(createOutletDto);
    return createdOutlet.save();
  }

  async findAll(query: QueryOutletDto) {
    const { page = 1, limit = 10, name, type } = query;
    const filter: any = { isDeleted: false };

    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (type) {
      filter.type = type;
    }

    const [data, total] = await Promise.all([
      this.outletModel
        .find(filter)
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
