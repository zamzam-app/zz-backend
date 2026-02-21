import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { hashPassword } from '../../util/password.util';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(createUserDto: CreateUserDto) {
    try {
      if (createUserDto.password) {
        createUserDto.password = await hashPassword(createUserDto.password);
      }
      const createdUser = new this.userModel(createUserDto);
      return createdUser.save();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to create user',
      );
    }
  }

  async findAll() {
    try {
      return this.userModel.find().exec();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to retrieve users',
      );
    }
  }

  async findOne(id: string) {
    try {
      const user = await this.userModel.findById(id).exec();
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      return user;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to retrieve user',
      );
    }
  }

  async findOneByName(name: string, includePassword = false) {
    try {
      const query = this.userModel.findOne({ name });
      if (includePassword) {
        query.select('+password');
      }
      return query.exec();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to retrieve user by name',
      );
    }
  }

  async findOneByEmail(email: string, includePassword = false) {
    try {
      const query = this.userModel.findOne({ email });
      if (includePassword) {
        query.select('+password');
      }
      return query.exec();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to retrieve user by email',
      );
    }
  }

  async findOneByPhoneNumber(phoneNumber: string) {
    try {
      return this.userModel.findOne({ phoneNumber }).exec();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to retrieve user by phone number',
      );
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const updatedUser = await this.userModel
        .findByIdAndUpdate(id, updateUserDto, { new: true })
        .exec();
      if (!updatedUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      return updatedUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to update user',
      );
    }
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    try {
      const user = await this.userModel
        .findById(userId)
        .select('+password')
        .exec();
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      if (!user.password && user.password === undefined) {
        throw new BadRequestException('User does not have a password set');
      }

      // compare old password
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        throw new BadRequestException('Old password is incorrect');
      }

      user.password = await hashPassword(newPassword);
      return user.save();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to change password',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedUser = await this.userModel.findByIdAndDelete(id).exec();
      if (!deletedUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      return deletedUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to delete user',
      );
    }
  }
}
