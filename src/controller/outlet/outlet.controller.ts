import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { OutletService } from './outlet.service';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApiOutletCreate,
  ApiOutletFindAll,
  ApiOutletFindOne,
  ApiOutletRemove,
  ApiOutletUpdate,
} from './dto/outlet.swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { QueryOutletDto } from './dto/query-outlet.dto';

@ApiTags('outlet')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('outlet')
export class OutletController {
  constructor(private readonly outletService: OutletService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOutletCreate()
  create(@Body() createOutletDto: CreateOutletDto) {
    return this.outletService.create(createOutletDto);
  }

  @Get()
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOutletFindAll()
  findAll(@Query() query: QueryOutletDto) {
    return this.outletService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOutletFindOne()
  findOne(@Param('id') id: string) {
    return this.outletService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOutletUpdate()
  update(@Param('id') id: string, @Body() updateOutletDto: UpdateOutletDto) {
    return this.outletService.update(id, updateOutletDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOutletRemove()
  remove(@Param('id') id: string) {
    return this.outletService.remove(id);
  }
}
