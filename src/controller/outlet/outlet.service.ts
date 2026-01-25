import { Injectable } from '@nestjs/common';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';

@Injectable()
export class OutletService {
  create(createOutletDto: CreateOutletDto) {
    return 'This action adds a new outlet';
  }

  findAll() {
    return `This action returns all outlet`;
  }

  findOne(id: number) {
    return `This action returns a #${id} outlet`;
  }

  update(id: number, updateOutletDto: UpdateOutletDto) {
    return `This action updates a #${id} outlet`;
  }

  remove(id: number) {
    return `This action removes a #${id} outlet`;
  }
}
