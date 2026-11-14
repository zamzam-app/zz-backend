import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/interfaces/user.interface';
import { CustomCakeService } from './custom-cake.service';
import { CreateCustomCakeDto } from './dto/create-custom-cake.dto';
import { QueryCustomCakeDto } from './dto/query-custom-cake.dto';
import {
  ApiCustomCakeCreate,
  ApiCustomCakeFindAll,
  ApiCustomCakeFindOne,
} from './dto/custom-cake.swagger';

@ApiTags('custom-cakes')
@Controller('custom-cakes')
export class CustomCakeController {
  constructor(private readonly customCakeService: CustomCakeService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @Public()
  @ApiCustomCakeCreate()
  create(@Body() dto: CreateCustomCakeDto) {
    return this.customCakeService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiCustomCakeFindAll()
  findAll(@Query() query: QueryCustomCakeDto) {
    return this.customCakeService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiCustomCakeFindOne()
  findOne(@Param('id') id: string) {
    return this.customCakeService.findOne(id);
  }
}
