import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { normalizePhoneNumber } from '../../util/normalize.util';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserRole } from '../users/interfaces/user.interface';
import { UsersService } from '../users/users.service';
import { CreateUploadedCakeDto } from './dto/create-uploaded-cake.dto';
import { QueryUploadedCakeDto } from './dto/query-uploaded-cake.dto';
import {
  UploadedCake,
  UploadedCakeDocument,
} from './entities/uploaded-cake.entity';
import { FindAllUploadedCakesResult } from './interfaces/query-uploaded-cake.interface';

@Injectable()
export class UploadedCakesService {
  constructor(
    @InjectModel(UploadedCake.name)
    private uploadedCakeModel: Model<UploadedCakeDocument>,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateUploadedCakeDto): Promise<UploadedCakeDocument> {
    try {
      if (!dto.phone?.trim()) {
        throw new BadRequestException('phone is required');
      }
      const prompt = dto.prompt?.trim() || dto.description?.trim();
      if (!prompt) {
        throw new BadRequestException('prompt is required');
      }

      const imageUrl = dto.imageUrl?.trim() || dto.referenceImageUrl?.trim();
      if (!imageUrl) {
        throw new BadRequestException('imageUrl is required');
      }

      const normalizedPhone = normalizePhoneNumber(dto.phone);
      if (!normalizedPhone) {
        throw new BadRequestException('Invalid phone number');
      }

      const existingUser =
        await this.usersService.findOneByPhoneNumber(normalizedPhone);

      let userId: string;
      if (existingUser) {
        userId = (
          existingUser as unknown as { _id: Types.ObjectId }
        )._id.toString();
      } else {
        const createdUser = await this.usersService.create({
          ...(dto.name?.trim() && { name: dto.name.trim() }),
          phoneNumber: normalizedPhone,
          ...(dto.dob?.trim() && { dob: dto.dob.trim() }),
          ...(dto.gender?.trim() && { gender: dto.gender.trim() }),
          role: UserRole.USER,
        } as CreateUserDto);
        userId = (
          createdUser as unknown as { _id: Types.ObjectId }
        )._id.toString();
      }

      const doc = new this.uploadedCakeModel({
        userId: new Types.ObjectId(userId),
        prompt,
        phone: normalizedPhone,
        imageUrl,
        ...(dto.dob?.trim() && { dob: new Date(dto.dob.trim()) }),
        ...(dto.gender?.trim() && { gender: dto.gender.trim() }),
        ...(dto.name?.trim() && { name: dto.name.trim() }),
        ...(dto.referenceImageUrl?.trim() && {
          referenceImageUrl: dto.referenceImageUrl.trim(),
        }),
        ...(dto.description?.trim() && { description: dto.description.trim() }),
      });

      const saved = await doc.save();
      await this.usersService.addUploadedCake(userId, saved._id.toString());

      return saved;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to save uploaded cake',
      );
    }
  }

  async findAll(
    query: QueryUploadedCakeDto,
  ): Promise<FindAllUploadedCakesResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const matchStage: Record<string, unknown> = { isDeleted: false };
      if (query.userId) {
        matchStage.userId = new Types.ObjectId(query.userId);
      }

      const total = await this.uploadedCakeModel
        .countDocuments(matchStage)
        .exec();

      const queryBuilder = this.uploadedCakeModel
        .find(matchStage)
        .sort({ createdAt: -1 })
        .populate('userId');

      if (limit) {
        queryBuilder.skip(skip).limit(limit);
      }

      const data = await queryBuilder.exec();
      const effectiveLimit = limit ?? total;

      return {
        data,
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
        (error as Error)?.message ?? 'Failed to list uploaded cakes',
      );
    }
  }

  async findOne(id: string): Promise<UploadedCakeDocument> {
    const doc = await this.uploadedCakeModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .populate('userId')
      .exec();

    if (!doc) {
      throw new NotFoundException(`Uploaded cake with ID ${id} not found`);
    }

    return doc;
  }
}
