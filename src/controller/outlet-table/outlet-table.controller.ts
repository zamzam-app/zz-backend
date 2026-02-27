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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OutletTableService } from './outlet-table.service';
import { CreateOutletTableDto } from './dto/create-outlet-table.dto';
import { UpdateOutletTableDto } from './dto/update-outlet-table.dto';
import { QueryOutletTableDto } from './dto/query-outlet-table.dto';
import {
  ApiOutletTableCreate,
  ApiOutletTableFindAll,
  ApiOutletTableFindOne,
  ApiOutletTableRemove,
  ApiOutletTableUpdate,
} from './dto/outlet-table.swagger';

@ApiTags('outlet-table')
@ApiBearerAuth('JWT-auth')
@Controller('outlet-table')
export class OutletTableController {
  constructor(private readonly outletTableService: OutletTableService) {}

  @Post()
  @ApiOutletTableCreate()
  create(@Body() createOutletTableDto: CreateOutletTableDto) {
    return this.outletTableService.create(createOutletTableDto);
  }

  @Get()
  @ApiOutletTableFindAll()
  findAll(@Query() query: QueryOutletTableDto) {
    return this.outletTableService.findAll(query);
  }

  @Get(':id')
  @ApiOutletTableFindOne()
  findOne(@Param('id') id: string) {
    return this.outletTableService.findOne(id);
  }

  @Patch(':id')
  @ApiOutletTableUpdate()
  update(
    @Param('id') id: string,
    @Body() updateOutletTableDto: UpdateOutletTableDto,
  ) {
    return this.outletTableService.update(id, updateOutletTableDto);
  }

  @Delete(':id')
  @ApiOutletTableRemove()
  remove(@Param('id') id: string) {
    return this.outletTableService.remove(id);
  }
}
