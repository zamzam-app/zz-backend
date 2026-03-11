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
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryCsatTrendlineDto } from './dto/query-csat-trendline.dto';
import { QueryGlobalCsatDto } from './dto/query-global-csat.dto';
import { QueryIncidentsOverviewDto } from './dto/query-incidents-overview.dto';
import { QueryOutletFeedbackDto } from './dto/query-outlet-feedback.dto';
import { QueryQuickInsightsDto } from './dto/query-quick-insights.dto';
import {
  ApiReviewCsatTrendline,
  ApiReviewFranchiseAnalytics,
  ApiReviewGlobalCsat,
  ApiReviewIncidentsOverview,
  ApiReviewOutletFeedbackSummary,
  ApiReviewQuickInsights,
  ApiReviewResolveComplaint,
  type ApiDecorator,
} from './dto/review.swagger';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

const franchiseAnalyticsDecorator =
  ApiReviewFranchiseAnalytics as () => ApiDecorator;

@ApiTags('review')
@ApiBearerAuth('JWT-auth')
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  create(@Body() createReviewDto: CreateReviewDto) {
    return this.reviewService.create(createReviewDto);
  }

  @Get()
  findAll(@Query() query: QueryReviewDto) {
    return this.reviewService.findAll(query);
  }

  @Get('analytics/global-csat')
  @ApiReviewGlobalCsat()
  getGlobalCsat(@Query() query: QueryGlobalCsatDto) {
    return this.reviewService.getGlobalCsat(query);
  }

  @Get('analytics/csat-trendline')
  @ApiReviewCsatTrendline()
  getCsatTrendline(@Query() query: QueryCsatTrendlineDto) {
    return this.reviewService.getCsatTrendline(query);
  }

  @Get('analytics/incidents-overview')
  @ApiReviewIncidentsOverview()
  getIncidentsOverview(@Query() query: QueryIncidentsOverviewDto) {
    return this.reviewService.getIncidentsOverview(query);
  }

  @Get('analytics/outlet-feedback-summary')
  @ApiReviewOutletFeedbackSummary()
  getOutletFeedbackSummary(@Query() query: QueryOutletFeedbackDto) {
    return this.reviewService.getOutletFeedbackSummary(query);
  }

  @Get('analytics/franchise')
  @franchiseAnalyticsDecorator()
  getFranchiseAnalytics(@Query() query: QueryGlobalCsatDto) {
    return this.reviewService.getFranchiseAnalytics(query);
  }

  @Get('analytics/quick-insights')
  @ApiReviewQuickInsights()
  getQuickInsights(@Query() query: QueryQuickInsightsDto) {
    return this.reviewService.getQuickInsights(query);
  }

  @Post('resolve-complaint/:reviewId')
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
  remove(@Param('id') id: string) {
    return this.reviewService.remove(id);
  }
}
