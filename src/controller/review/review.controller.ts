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
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { QueryRatingsSummaryDto } from './dto/query-ratings-summary.dto';
import { MarkReviewReadDto } from './dto/mark-review-read.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import {
  ApiReviewBadgeStatus,
  ApiReviewMarkRead,
  ApiReviewRatingsSummary,
  ApiReviewResolveComplaint,
} from './dto/review.swagger';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SubmitReviewWithOtpDto } from './dto/submit-review-with-otp.dto';

@ApiTags('review')
@ApiBearerAuth('JWT-auth')
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Public()
  @Post('submit-with-otp')
  submitWithOtp(@Body() dto: SubmitReviewWithOtpDto) {
    return this.reviewService.submitWithOtp(dto);
  }

  @Post()
  create(@Body() createReviewDto: CreateReviewDto) {
    return this.reviewService.create(createReviewDto);
  }

  @Get()
  findAll(@Query() query: QueryReviewDto) {
    return this.reviewService.findAll(query);
  }

  @Get('badge-status/:userId')
  @ApiReviewBadgeStatus()
  getBadgeStatus(@Param('userId') userId: string) {
    return this.reviewService.getBadgeStatus(userId);
  }

  @Public()
  @Get('ratings-summary')
  @ApiReviewRatingsSummary()
  getRatingsSummary(@Query() query: QueryRatingsSummaryDto) {
    return this.reviewService.getRatingsSummary(query);
  }

  @Post('resolve-complaint/:reviewId')
  @ApiReviewResolveComplaint()
  resolveComplaint(
    @Param('reviewId') reviewId: string,
    @Body() body: ResolveComplaintDto,
  ) {
    return this.reviewService.resolveComplaint(reviewId, body);
  }

  @Post(':reviewId/mark-read')
  @ApiReviewMarkRead()
  markRead(
    @Param('reviewId') reviewId: string,
    @Body() body: MarkReviewReadDto,
  ) {
    return this.reviewService.markReviewAsRead(reviewId, body.userId);
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
  remove(@Param('id') id: string) {
    return this.reviewService.remove(id);
  }
}
