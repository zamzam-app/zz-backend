import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CustomCake, CustomCakeDocument } from './entities/custom-cake.entity';
import { CreateCustomCakeDto } from './dto/create-custom-cake.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class CustomCakeService {
  constructor(
    @InjectModel(CustomCake.name) private customCakeModel: Model<CustomCake>,
    private readonly usersService: UsersService,
  ) {}

  async create(
    userId: string,
    dto: CreateCustomCakeDto,
  ): Promise<CustomCakeDocument> {
    try {
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
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
