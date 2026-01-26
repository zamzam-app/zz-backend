import { Injectable } from '@nestjs/common';
import { CreateOutletTypeDto } from './dto/create-outlet-type.dto';
import { UpdateOutletTypeDto } from './dto/update-outlet-type.dto';

@Injectable()
export class OutletTypeService {
  create(createOutletTypeDto: CreateOutletTypeDto) {
    return 'This action adds a new outletType';
  }

  findAll() {
    return `This action returns all outletType`;
  }

  findOne(id: number) {
    return `This action returns a #${id} outletType`;
  }

  update(id: number, updateOutletTypeDto: UpdateOutletTypeDto) {
    return `This action updates a #${id} outletType`;
  }

  remove(id: number) {
    return `This action removes a #${id} outletType`;
  }
}
