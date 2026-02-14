import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { OutletTypeService } from './outlet-type.service';
import { CreateOutletTypeDto } from './dto/create-outlet-type.dto';
import { UpdateOutletTypeDto } from './dto/update-outlet-type.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiOutletTypeCreate,
  ApiOutletTypeFindAll,
  ApiOutletTypeFindOne,
  ApiOutletTypeUpdate,
  ApiOutletTypeRemove,
} from './dto/outlet-type.swagger';

@ApiTags('Outlet Type')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('outlet-type')
export class OutletTypeController {
  constructor(private readonly outletTypeService: OutletTypeService) {}

  @Post()
  @ApiOutletTypeCreate()
  create(@Body() createOutletTypeDto: CreateOutletTypeDto) {
    return this.outletTypeService.create(createOutletTypeDto);
  }

  @Get()
  @ApiOutletTypeFindAll()
  findAll() {
    return this.outletTypeService.findAll();
  }

  @Get(':id')
  @ApiOutletTypeFindOne()
  findOne(@Param('id') id: string) {
    return this.outletTypeService.findOne(id);
  }

  @Patch(':id')
  @ApiOutletTypeUpdate()
  update(
    @Param('id') id: string,
    @Body() updateOutletTypeDto: UpdateOutletTypeDto,
  ) {
    return this.outletTypeService.update(id, updateOutletTypeDto);
  }

  @Delete(':id')
  @ApiOutletTypeRemove()
  remove(@Param('id') id: string) {
    return this.outletTypeService.remove(id);
  }
}
