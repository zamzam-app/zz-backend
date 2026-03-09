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
import { Model, Types } from 'mongoose';
import { FindAllUsersResult } from './interfaces/query-user.interface';
import { UserRole } from './interfaces/user.interface';
import * as bcrypt from 'bcrypt';
import { hashPassword } from '../../util/password.util';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const { data: existingUser, userPresent } =
        await this.findUserByIdentifiers({
          userName: createUserDto.userName,
          phoneNumber: createUserDto.phoneNumber,
          email: createUserDto.email,
        });

      if (userPresent && existingUser) {
        const takenFields: string[] = [];
        if (createUserDto.email && existingUser.email === createUserDto.email) {
          takenFields.push('email');
        }
        if (
          createUserDto.userName &&
          existingUser.userName === createUserDto.userName
        ) {
          takenFields.push('userName');
        }
        if (
          createUserDto.phoneNumber &&
          existingUser.phoneNumber === createUserDto.phoneNumber
        ) {
          takenFields.push('phoneNumber');
        }
        if (takenFields.length > 0) {
          throw new BadRequestException(
            `${takenFields.join(', ')} ${takenFields.length === 1 ? 'is' : 'are'} already taken`,
          );
        }
      }

      if (createUserDto.password) {
        createUserDto.password = await hashPassword(createUserDto.password);
      }
      const doc = { ...createUserDto } as Record<string, unknown>;
      if (doc._id) {
        doc._id = new Types.ObjectId(doc._id as string);
      }
      const createdUser = new this.userModel(doc);
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
    const { data } = await this.findUserByIdentifiers({ phoneNumber });
    return data;
  }

  async addUserReview(userId: string, reviewId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        $push: { userReviews: new Types.ObjectId(reviewId) },
      })
      .exec();
  }

  /**
   * Finds a user by userId or phoneNumber. If not found, creates a minimal user
   * via create() and returns it. Used when creating reviews so the author exists.
   */
  async findOneOrCreateForReview(params: {
    userId?: string;
    phoneNumber?: string;
  }): Promise<{ _id: Types.ObjectId } | null> {
    if (!params.userId && !params.phoneNumber) return null;
    const { data, userPresent } = await this.findUserByIdentifiers({
      userId: params.userId,
      phoneNumber: params.phoneNumber,
    });
    if (userPresent && data) return data as User & { _id: Types.ObjectId };
    const created = await this.create({
      _id: params.userId,
      phoneNumber: params.phoneNumber?.trim() || undefined,
      role: UserRole.USER,
    } as CreateUserDto);
    return created as User & { _id: Types.ObjectId };
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
  /**
   * Finds a user by any of the provided identifiers (userId, userName, phoneNumber, email).
   * Uses $or so the first match wins. Returns the user and whether one was found.
   */
  async findUserByIdentifiers(params: {
    userId?: string;
    userName?: string;
    phoneNumber?: string;
    email?: string;
  }): Promise<{ data: User | null; userPresent: boolean }> {
    try {
      const orClauses: Record<string, unknown>[] = [];
      if (params.userId?.trim()) {
        orClauses.push({ _id: new Types.ObjectId(params.userId) });
      }
      if (params.phoneNumber?.trim()) {
        orClauses.push({ phoneNumber: params.phoneNumber });
      }
      if (params.email?.trim()) {
        orClauses.push({ email: params.email });
      }
      if (params.userName?.trim()) {
        orClauses.push({ userName: params.userName });
      }
      if (orClauses.length === 0) {
        return { data: null, userPresent: false };
      }
      const user = await this.userModel
        .findOne({ $or: orClauses, isDeleted: false })
        .exec();
      return { data: user ?? null, userPresent: !!user };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to find user by identifiers',
      );
    }
  }
}
