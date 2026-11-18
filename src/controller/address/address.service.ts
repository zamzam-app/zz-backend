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
    user: JwtPayload,
  ): Promise<Address> {
    // Only admins may create an address on behalf of another user.
    const userId =
      user.role === UserRole.ADMIN && createAddressDto.userId
        ? createAddressDto.userId
        : user.sub;
    const createdAddress = new this.addressModel({
      ...createAddressDto,
      userId,
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

  /** Admins may change any address; others only addresses they own. */
  private async assertCanModify(id: string, user: JwtPayload): Promise<void> {
    if (user.role === UserRole.ADMIN) return;
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Address with ID ${id} not found`);
    }
    const address = await this.addressModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .select('userId')
      .lean()
      .exec();
    if (!address) {
      throw new NotFoundException(`Address with ID ${id} not found`);
    }
    if (!address.userId || address.userId.toString() !== user.sub) {
      throw new ForbiddenException(
        'You do not have permission to modify this address',
      );
    }
  }

  async update(
    id: string,
    updateAddressDto: UpdateAddressDto,
    user: JwtPayload,
  ): Promise<Address> {
    await this.assertCanModify(id, user);
    // Ownership can only be reassigned by an admin.
    if (user.role !== UserRole.ADMIN) {
      delete updateAddressDto.userId;
    }
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

  async remove(id: string, user: JwtPayload): Promise<{ message: string }> {
    await this.assertCanModify(id, user);
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
