import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { QueryCsatTrendlineDto } from '../review/dto/query-csat-trendline.dto';
import { QueryGlobalCsatDto } from '../review/dto/query-global-csat.dto';
import { QueryIncidentsOverviewDto } from '../review/dto/query-incidents-overview.dto';
import { QueryOutletFeedbackDto } from '../review/dto/query-outlet-feedback.dto';
import { QueryQuickInsightsDto } from './dto/query-quick-insights.dto';
import {
  ApiReviewCsatTrendline,
  ApiReviewFranchiseAnalytics,
  ApiReviewGlobalCsat,
  ApiReviewIncidentsOverview,
  ApiReviewOutletFeedbackSummary,
  ApiReviewQuickInsights,
} from './dto/analytics.swagger';

@ApiTags('analytics')
@ApiBearerAuth('JWT-auth')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('global-csat')
  @ApiReviewGlobalCsat()
  getGlobalCsat(@Query() query: QueryGlobalCsatDto) {
    return this.analyticsService.getGlobalCsat(query);
  }

  @Get('csat-trendline')
  @ApiReviewCsatTrendline()
  getCsatTrendline(@Query() query: QueryCsatTrendlineDto) {
    return this.analyticsService.getCsatTrendline(query);
  }

  @Get('incidents-overview')
  @ApiReviewIncidentsOverview()
  getIncidentsOverview(@Query() query: QueryIncidentsOverviewDto) {
    return this.analyticsService.getIncidentsOverview(query);
  }

  @Get('outlet-feedback-summary')
  @ApiReviewOutletFeedbackSummary()
  getOutletFeedbackSummary(@Query() query: QueryOutletFeedbackDto) {
    return this.analyticsService.getOutletFeedbackSummary(query);
  }

  @Get('quick-insights')
  @ApiReviewQuickInsights()
  getQuickInsights(@Query() query: QueryQuickInsightsDto) {
    return this.analyticsService.getQuickInsights(query);
  }

  @Get('franchise')
  @ApiReviewFranchiseAnalytics()
  getFranchiseAnalytics(@Query() query: QueryGlobalCsatDto) {
    return this.analyticsService.getFranchiseAnalytics(query);
  }
}
