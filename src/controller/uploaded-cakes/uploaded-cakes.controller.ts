import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/interfaces/user.interface';
import { CreateUploadedCakeDto } from './dto/create-uploaded-cake.dto';
import { QueryUploadedCakeDto } from './dto/query-uploaded-cake.dto';
import {
  ApiUploadedCakeCreate,
  ApiUploadedCakeFindAll,
  ApiUploadedCakeFindOne,
} from './dto/uploaded-cake.swagger';
import { UploadedCakesService } from './uploaded-cakes.service';

@ApiTags('uploaded-cakes')
@Controller('uploaded-cakes')
export class UploadedCakesController {
  constructor(private readonly uploadedCakesService: UploadedCakesService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @Public()
  @ApiUploadedCakeCreate()
  create(@Body() dto: CreateUploadedCakeDto) {
    return this.uploadedCakesService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiUploadedCakeFindAll()
  findAll(@Query() query: QueryUploadedCakeDto) {
    return this.uploadedCakesService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiUploadedCakeFindOne()
  findOne(@Param('id') id: string) {
    return this.uploadedCakesService.findOne(id);
  }
}
