import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import { FindAllUsersResult } from './interfaces/query-user.interface';
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

  async findAll(query: QueryUserDto): Promise<FindAllUsersResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const dataPipeline = limit ? [{ $skip: skip }, { $limit: limit }] : [];

      const matchStage: Record<string, unknown> = { isDeleted: false };
      if (query.role != null) {
        matchStage.role = query.role;
      }

      const [result] = await this.userModel
        .aggregate<{
          data: User[];
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
        (error as Error)?.message ?? 'Failed to retrieve users',
      );
    }
  }

  async findOne(id: string) {
    try {
      const user = await this.userModel.findById(id).lean().exec();
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

  async setOtp(userId: string, otp: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { otp }).exec();
  }

  async clearOtp(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { $unset: { otp: 1 } })
      .exec();
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
      const deletedUser = await this.userModel
        .findOneAndUpdate(
          { _id: id, isDeleted: false },
          { isDeleted: true },
          { new: true },
        )
        .exec();
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
