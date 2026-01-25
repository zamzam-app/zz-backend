import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { Outlet, OutletDocument } from './entities/outlet.entity';

@Injectable()
export class OutletService {
  constructor(
    @InjectModel(Outlet.name) private outletModel: Model<OutletDocument>,
  ) {}

  async create(createOutletDto: CreateOutletDto): Promise<Outlet> {
    const createdOutlet = new this.outletModel(createOutletDto);
    return createdOutlet.save();
  }

  async findAll(): Promise<Outlet[]> {
    return this.outletModel.find({ isDeleted: false }).exec();
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
