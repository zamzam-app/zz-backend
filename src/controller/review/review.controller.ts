import { Throttle } from '@nestjs/throttler';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  ForbiddenException,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/interfaces/user.interface';
import { JwtPayload } from '../auth/interfaces/auth.interfaces';
import { QueryPublicReviewsDto } from './dto/query-public-reviews.dto';
import { SubmitReviewWithOtpDto } from './dto/submit-review-with-otp.dto';

@ApiTags('review')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /** Badge and read state belong to the caller; never trust a userId from the client. */
  private assertSelf(user: JwtPayload, userId: string): void {
    if (user.sub !== userId) {
      throw new ForbiddenException('You can only access your own review state');
    }
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('submit-with-otp')
  submitWithOtp(@Body() dto: SubmitReviewWithOtpDto) {
    return this.reviewService.submitWithOtp(dto);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() createReviewDto: CreateReviewDto) {
    return this.reviewService.create(createReviewDto);
  }

  @Get()
  findAll(
    @Query() query: QueryReviewDto,
    @Request() req: { user: JwtPayload },
  ) {
    // Managers only get reviews of their own outlets.
    return this.reviewService.findAll(query, req.user);
  }

  @Get('badge-status/:userId')
  @ApiReviewBadgeStatus()
  getBadgeStatus(
    @Param('userId') userId: string,
    @Request() req: { user: JwtPayload },
  ) {
    this.assertSelf(req.user, userId);
    return this.reviewService.getBadgeStatus(userId);
  }

  @Public()
  @Get('ratings-summary')
  @ApiReviewRatingsSummary()
  getRatingsSummary(@Query() query: QueryRatingsSummaryDto) {
    return this.reviewService.getRatingsSummary(query);
  }

  /** Customer-site testimonials: non-complaint reviews with no contact details. */
  @Public()
  @Get('public')
  getPublicReviews(@Query() query: QueryPublicReviewsDto) {
    return this.reviewService.getPublicReviews(query);
  }

  @Post('resolve-complaint/:reviewId')
  @ApiReviewResolveComplaint()
  resolveComplaint(
    @Param('reviewId') reviewId: string,
    @Body() body: ResolveComplaintDto,
    @Request() req: { user: JwtPayload },
  ) {
    // The resolver is always the authenticated user, never a body value.
    return this.reviewService.resolveComplaint(
      reviewId,
      body,
      req.user.sub,
      req.user,
    );
  }

  @Post(':reviewId/mark-read')
  @ApiReviewMarkRead()
  markRead(
    @Param('reviewId') reviewId: string,
    @Body() body: MarkReviewReadDto,
    @Request() req: { user: JwtPayload },
  ) {
    this.assertSelf(req.user, body.userId);
    return this.reviewService.markReviewAsRead(reviewId, body.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: JwtPayload }) {
    return this.reviewService.findOne(id, req.user);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto) {
    return this.reviewService.update(id, updateReviewDto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reviewService.remove(id);
  }
}
