import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './entities/user.entity';
import { Model, Types } from 'mongoose';
import { FindAllUsersResult } from './interfaces/query-user.interface';
import { UserRole } from './interfaces/user.interface';
import * as bcrypt from 'bcrypt';
import { hashPassword } from '../../util/password.util';
import {
  normalizeEmail,
  normalizePhoneNumber,
} from '../../util/normalize.util';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const normEmail = normalizeEmail(createUserDto.email);
      const normPhone = normalizePhoneNumber(createUserDto.phoneNumber);
      const { data: existingUser, userPresent } =
        await this.findUserByIdentifiers({
          userName: createUserDto.userName,
          phoneNumber: createUserDto.phoneNumber,
          email: createUserDto.email,
          includeDeleted: true,
        });

      if (userPresent && existingUser) {
        if (existingUser.isDeleted) {
          const updateDoc: Record<string, unknown> = {
            ...createUserDto,
            isDeleted: false,
            isActive: true,
          };
          if (updateDoc.password) {
            updateDoc.password = await hashPassword(
              updateDoc.password as string,
            );
          }
          if (updateDoc._id) {
            delete updateDoc._id;
          }

          const existingId = (existingUser as User & { _id: Types.ObjectId })
            ._id;
          const revived = await this.userModel
            .findByIdAndUpdate(existingId, updateDoc, { new: true })
            .exec();

          if (!revived) {
            throw new InternalServerErrorException(
              'Failed to restore deleted user',
            );
          }

          return revived;
        }

        const takenFields: string[] = [];
        if (
          createUserDto.email &&
          normalizeEmail(existingUser.email) === normEmail
        ) {
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
          normalizePhoneNumber(existingUser.phoneNumber) === normPhone
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
      if (normEmail && doc.email !== undefined) {
        doc.email = normEmail;
      }
      if (normPhone && doc.phoneNumber !== undefined) {
        doc.phoneNumber = normPhone;
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
      const payload = { ...updateUserDto };
      if (payload.email != null)
        payload.email = normalizeEmail(payload.email) || payload.email;
      if (payload.phoneNumber != null)
        payload.phoneNumber =
          normalizePhoneNumber(payload.phoneNumber) || payload.phoneNumber;
      const updatedUser = await this.userModel
        .findByIdAndUpdate(id, payload, { new: true })
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

  /**
   * Verifies OTP for a user by phone number. Does not clear OTP.
   * Throws UnauthorizedException if user not found or OTP does not match.
   */
  async verifyOtp(phoneNumber: string, otp: string): Promise<UserDocument> {
    const normPhone = normalizePhoneNumber(phoneNumber);
    if (!normPhone) {
      throw new UnauthorizedException('Invalid OTP');
    }
    const user = await this.userModel
      .findOne({ phoneNumber: normPhone, isDeleted: false })
      .select('+otp')
      .exec();
    if (!user || (user as User & { otp?: string }).otp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }
    return user;
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
   * Returns true if there is another (non-deleted) user document with the given email,
   * excluding the user with the provided excludeUserId.
   */
  async isEmailTakenByAnotherUser(
    email: string,
    excludeUserId: string,
  ): Promise<boolean> {
    try {
      const norm = normalizeEmail(email);
      if (!norm) return false;
      const existing = await this.userModel
        .exists({
          email: norm,
          isDeleted: false,
          _id: { $ne: new Types.ObjectId(excludeUserId) },
        })
        .exec();
      return !!existing;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to check email uniqueness',
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
    includeDeleted?: boolean;
  }): Promise<{ data: User | null; userPresent: boolean }> {
    try {
      const orClauses: Record<string, unknown>[] = [];
      if (params.userId?.trim()) {
        orClauses.push({ _id: new Types.ObjectId(params.userId) });
      }
      if (params.phoneNumber?.trim()) {
        const norm = normalizePhoneNumber(params.phoneNumber);
        if (norm) orClauses.push({ phoneNumber: norm });
      }
      if (params.email?.trim()) {
        const norm = normalizeEmail(params.email);
        if (norm) orClauses.push({ email: norm });
      }
      if (params.userName?.trim()) {
        orClauses.push({ userName: params.userName });
      }
      if (orClauses.length === 0) {
        return { data: null, userPresent: false };
      }
      const match: Record<string, unknown> = { $or: orClauses };
      if (!params.includeDeleted) {
        match.isDeleted = false;
      }
      const user = await this.userModel.findOne(match).exec();
      return { data: user ?? null, userPresent: !!user };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to find user by identifiers',
      );
    }
  }
}
