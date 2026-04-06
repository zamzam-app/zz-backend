import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { normalizePhoneNumber } from '../../util/normalize.util';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserRole } from '../users/interfaces/user.interface';
import { UsersService } from '../users/users.service';
import { CreateUploadedCakeDto } from './dto/create-uploaded-cake.dto';
import {
  UploadedCake,
  UploadedCakeDocument,
} from './entities/uploaded-cake.entity';

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
          name: dto.name.trim(),
          phoneNumber: normalizedPhone,
          role: UserRole.USER,
        } as CreateUserDto);
        userId = (
          createdUser as unknown as { _id: Types.ObjectId }
        )._id.toString();
      }

      const doc = new this.uploadedCakeModel({
        userId: new Types.ObjectId(userId),
        name: dto.name.trim(),
        phone: normalizedPhone,
        referenceImageUrl: dto.referenceImageUrl.trim(),
        description: dto.description.trim(),
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
}
