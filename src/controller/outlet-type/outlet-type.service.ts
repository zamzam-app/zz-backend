import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOutletTypeDto } from './dto/create-outlet-type.dto';
import { UpdateOutletTypeDto } from './dto/update-outlet-type.dto';
import { InjectModel } from '@nestjs/mongoose';
import { OutletType, OutletTypeDocument } from './entities/outlet-type.entity';
import { Model, Types } from 'mongoose';

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

  async findAll(): Promise<OutletType[]> {
    return this.outletTypeModel.find({ isDeleted: false }).exec();
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
