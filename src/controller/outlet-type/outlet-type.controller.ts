import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { OutletTypeService } from './outlet-type.service';
import { CreateOutletTypeDto } from './dto/create-outlet-type.dto';
import { UpdateOutletTypeDto } from './dto/update-outlet-type.dto';

@Controller('outlet-type')
export class OutletTypeController {
  constructor(private readonly outletTypeService: OutletTypeService) {}

  @Post()
  create(@Body() createOutletTypeDto: CreateOutletTypeDto) {
    return this.outletTypeService.create(createOutletTypeDto);
  }

  @Get()
  findAll() {
    return this.outletTypeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.outletTypeService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateOutletTypeDto: UpdateOutletTypeDto,
  ) {
    return this.outletTypeService.update(+id, updateOutletTypeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.outletTypeService.remove(+id);
  }
}
