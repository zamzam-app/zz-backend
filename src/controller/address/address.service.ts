import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Address, AddressDocument } from './entities/address.entity';
import { Model, Types } from 'mongoose';
import { JwtPayload } from '../auth/interfaces/auth.interfaces';
import { UserRole } from '../users/interfaces/user.interface';

@Injectable()
export class AddressService {
  constructor(
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
  ) {}

  async create(
    createAddressDto: CreateAddressDto,
    userId?: string,
  ): Promise<Address> {
    const createdAddress = new this.addressModel({
      ...createAddressDto,
      userId: createAddressDto.userId || userId,
    });
    return createdAddress.save();
  }

  async findAll(): Promise<Address[]> {
    return this.addressModel.find({ isDeleted: false }).exec();
  }

  async findOne(id: string, user: JwtPayload): Promise<Address> {
    const address = await this.addressModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .exec();
    if (!address) {
      throw new NotFoundException(`Address with ID ${id} not found`);
    }

    // Ownership check: if role is USER and address has a userId, it must match current user
    if (
      user.role === UserRole.USER &&
      address.userId &&
      address.userId.toString() !== user.sub
    ) {
      throw new ForbiddenException(
        'You do not have permission to access this address',
      );
    }

    return address;
  }

  async update(
    id: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<Address> {
    const updatedAddress = await this.addressModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        updateAddressDto,
        { new: true },
      )
      .exec();
    if (!updatedAddress) {
      throw new NotFoundException(`Address with ID ${id} not found`);
    }
    return updatedAddress;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.addressModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        { isDeleted: true },
      )
      .exec();
    if (!result) {
      throw new NotFoundException(`Address with ID ${id} not found`);
    }
    return { message: 'Address deleted successfully' };
  }
}
