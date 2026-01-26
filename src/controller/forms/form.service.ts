import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Form, FormDocument } from './entities/form.entity';
import { Model, Types } from 'mongoose';
import { JwtPayload } from '../auth/interfaces/auth.interfaces';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class FormService {
  constructor(@InjectModel(Form.name) private formModel: Model<FormDocument>) {}

  async create(createFormDto: CreateFormDto, userId?: string): Promise<Form> {
    const createdForm = new this.formModel({
      ...createFormDto,
      userId: createFormDto.userId || userId,
    });
    return createdForm.save();
  }

  async findAll(): Promise<Form[]> {
    return this.formModel.find({ isDeleted: false }).exec();
  }

  async findOne(id: string, user: JwtPayload): Promise<Form> {
    const form = await this.formModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .exec();
    if (!form) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }

    // Ownership check: if role is USER and form has a userId, it must match current user
    if (
      user.role === UserRole.USER &&
      form.userId &&
      form.userId.toString() !== user.sub
    ) {
      throw new ForbiddenException(
        'You do not have permission to access this form',
      );
    }

    return form;
  }

  async update(id: string, updateFormDto: UpdateFormDto): Promise<Form> {
    const updatedForm = await this.formModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        updateFormDto,
        { new: true },
      )
      .exec();
    if (!updatedForm) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }
    return updatedForm;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.formModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        { isDeleted: true },
      )
      .exec();
    if (!result) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }
    return { message: 'Form deleted successfully' };
  }
}
