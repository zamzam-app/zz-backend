import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ApiReviewResolveComplaint } from './dto/review.swagger';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/interfaces/user.interface';

@ApiTags('review')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  create(@Body() createReviewDto: CreateReviewDto, @Request() req) {
    const userId = req.user.sub;
    return this.reviewService.create({ ...createReviewDto, userId });
  }

  @Get()
  findAll(@Query() query: QueryReviewDto) {
    return this.reviewService.findAll(query);
  }

  @Post('resolve-complaint/:reviewId')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiReviewResolveComplaint()
  resolveComplaint(
    @Param('reviewId') reviewId: string,
    @Body() body: ResolveComplaintDto,
  ) {
    return this.reviewService.resolveComplaint(reviewId, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto) {
    return this.reviewService.update(id, updateReviewDto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.reviewService.remove(id);
  }
}
