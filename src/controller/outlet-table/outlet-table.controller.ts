import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { OutletTableService } from './outlet-table.service';
import { CreateOutletTableDto } from './dto/create-outlet-table.dto';
import { UpdateOutletTableDto } from './dto/update-outlet-table.dto';
import { QueryOutletTableDto } from './dto/query-outlet-table.dto';

@Controller('outlet-table')
export class OutletTableController {
  constructor(private readonly outletTableService: OutletTableService) {}

  @Post()
  create(@Body() createOutletTableDto: CreateOutletTableDto) {
    return this.outletTableService.create(createOutletTableDto);
  }

  @Get()
  findAll(@Query() query: QueryOutletTableDto) {
    return this.outletTableService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.outletTableService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateOutletTableDto: UpdateOutletTableDto,
  ) {
    return this.outletTableService.update(id, updateOutletTableDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.outletTableService.remove(id);
  }
}
