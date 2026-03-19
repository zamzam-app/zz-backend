import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
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

  @Post()
  @Public()
  @ApiCustomCakeCreate()
  create(@Body() dto: CreateCustomCakeDto) {
    return this.customCakeService.create(dto);
  }

  @Get()
  @Public()
  @ApiCustomCakeFindAll()
  findAll(@Query() query: QueryCustomCakeDto) {
    return this.customCakeService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiCustomCakeFindOne()
  findOne(@Param('id') id: string) {
    return this.customCakeService.findOne(id);
  }
}
