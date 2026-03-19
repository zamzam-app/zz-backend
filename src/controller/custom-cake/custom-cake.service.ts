import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CustomCake, CustomCakeDocument } from './entities/custom-cake.entity';
import { CreateCustomCakeDto } from './dto/create-custom-cake.dto';
import { UsersService } from '../users/users.service';
import { normalizePhoneNumber } from '../../util/normalize.util';
import { UserRole } from '../users/interfaces/user.interface';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class CustomCakeService {
  constructor(
    @InjectModel(CustomCake.name) private customCakeModel: Model<CustomCake>,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateCustomCakeDto): Promise<CustomCakeDocument> {
    try {
      if (!dto.phone?.trim()) {
        throw new BadRequestException('phone is required');
      }

      const normPhone = normalizePhoneNumber(dto.phone);
      if (!normPhone) {
        throw new BadRequestException('Invalid phone number');
      }

      const existingUser =
        await this.usersService.findOneByPhoneNumber(normPhone);
      let userId: string;

      if (existingUser) {
        userId = (
          existingUser as unknown as { _id: Types.ObjectId }
        )._id.toString();
        const updatePayload: { dob?: string; gender?: string } = {};
        if (dto.dob != null) updatePayload.dob = dto.dob;
        if (dto.gender != null) updatePayload.gender = dto.gender;
        if (Object.keys(updatePayload).length > 0) {
          await this.usersService.update(userId, updatePayload);
        }
      } else {
        const newUser = await this.usersService.create({
          phoneNumber: normPhone,
          role: UserRole.USER,
          dob: dto.dob,
          gender: dto.gender,
        } as CreateUserDto);
        userId = (newUser as unknown as { _id: Types.ObjectId })._id.toString();
      }

      const doc = new this.customCakeModel({
        userId: new Types.ObjectId(userId),
        prompt: dto.prompt.trim(),
        imageUrl: dto.imageUrl.trim(),
      });
      const saved = await doc.save();

      await this.usersService.addCustomCake(userId, saved._id.toString());

      return saved;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to save custom cake',
      );
    }
  }
}
