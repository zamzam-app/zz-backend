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
import { RatingService } from './rating.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { QueryRatingDto } from './dto/query-rating.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';
import { ApiRatingResolveComplaint } from './dto/rating.swagger';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('rating')
@ApiBearerAuth('JWT-auth')
@Controller('rating')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Post()
  create(@Body() createRatingDto: CreateRatingDto) {
    return this.ratingService.create(createRatingDto);
  }

  @Get()
  findAll(@Query() query: QueryRatingDto) {
    return this.ratingService.findAll(query);
  }

  @Post('resolve-complaint/:ratingId')
  @ApiRatingResolveComplaint()
  resolveComplaint(
    @Param('ratingId') ratingId: string,
    @Body() body: ResolveComplaintDto,
  ) {
    return this.ratingService.resolveComplaint(ratingId, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ratingService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRatingDto: UpdateRatingDto) {
    return this.ratingService.update(id, updateRatingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ratingService.remove(id);
  }
}
