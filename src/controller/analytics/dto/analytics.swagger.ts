import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AnalyticsPeriod } from '../../review/dto/query-global-csat.dto';
import { FranchiseAnalyticsResponseDto } from '../../review/dto/franchise-analytics-response.dto';

export class GlobalCsatResponseSwagger {
  @ApiProperty({ example: 4.2, description: 'Global CSAT score out of 5' })
  globalCsatScore: number;

  @ApiProperty({
    example: 4.2,
    description: 'Alias of global CSAT score for compatibility',
  })
  averageOverallRating: number;

  @ApiProperty({ example: 124, description: 'Total reviews in selected range' })
  totalRatings: number;

  @ApiProperty({ example: 520.3, description: 'Sum of overall ratings' })
  totalScore: number;

  @ApiPropertyOptional({
    example: AnalyticsPeriod.MONTHLY,
    enum: AnalyticsPeriod,
    description: 'Applied preset period when provided',
  })
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({
    example: '2026-02-10T00:00:00.000Z',
    description: 'Applied date range start',
  })
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-03-10T23:59:59.999Z',
    description: 'Applied date range end',
  })
  endDate?: string;
}

export function ApiReviewGlobalCsat() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get global CSAT score across all outlets',
      description:
        'Aggregates overallRating from all active reviews and returns score out of 5.',
    }),
    ApiOkResponse({
      description: 'Global CSAT fetched successfully.',
      type: GlobalCsatResponseSwagger,
    }),
    ApiBadRequestResponse({
      description: 'Invalid date range query.',
    }),
  );
}

export class CsatTrendlinePeriodSwagger {
  @ApiProperty({ example: '2026-02-09T00:00:00.000Z' })
  startDate: string;

  @ApiProperty({ example: '2026-03-10T18:29:59.999Z' })
  endDate: string;

  @ApiProperty({
    example: ['Feb 13', 'Feb 18', 'Feb 23', 'Feb 28', 'Mar 05', 'Mar 10'],
    type: [String],
  })
  labels: string[];

  @ApiProperty({ example: [3.2, 3.5, 3.4, 3.6, 3.7, 3.8], type: [Number] })
  values: number[];

  @ApiProperty({ example: 52 })
  totalRatings: number;
}

export class CsatTrendlineResponseSwagger {
  @ApiProperty({ enum: AnalyticsPeriod, example: AnalyticsPeriod.MONTHLY })
  period: AnalyticsPeriod;

  @ApiProperty({ type: CsatTrendlinePeriodSwagger })
  currentPeriod: CsatTrendlinePeriodSwagger;

  @ApiProperty({ type: CsatTrendlinePeriodSwagger })
  previousPeriod: CsatTrendlinePeriodSwagger;
}

export function ApiReviewCsatTrendline() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get CSAT trendline data',
      description:
        'Returns current and previous period CSAT series for daily, weekly, or monthly trendline charts.',
    }),
    ApiOkResponse({
      description: 'CSAT trendline fetched successfully.',
      type: CsatTrendlineResponseSwagger,
    }),
    ApiBadRequestResponse({
      description: 'Invalid trendline query.',
    }),
  );
}

export class IncidentsOverviewResponseSwagger {
  @ApiProperty({
    example: 12,
    description: 'Open incidents in selected period',
  })
  totalOpenIncidents: number;

  @ApiProperty({
    example: 4,
    description:
      'Open critical incidents in selected period (complaints with overallRating < 2)',
  })
  criticalIssues: number;

  @ApiProperty({
    example: 3,
    description: 'Incidents resolved today (UTC day)',
  })
  incidentsResolvedToday: number;

  @ApiPropertyOptional({
    example: AnalyticsPeriod.MONTHLY,
    enum: AnalyticsPeriod,
    description: 'Applied preset period when provided',
  })
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({
    example: '2026-02-10T00:00:00.000Z',
    description: 'Applied date range start',
  })
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-03-10T23:59:59.999Z',
    description: 'Applied date range end',
  })
  endDate?: string;

  @ApiProperty({
    example: '2026-03-10',
    description: 'UTC date used for incidentsResolvedToday',
  })
  resolvedTodayDate: string;
}

export function ApiReviewIncidentsOverview() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get incident overview metrics',
      description:
        'Returns total open incidents, critical open incidents, and incidents resolved today.',
    }),
    ApiOkResponse({
      description: 'Incident overview fetched successfully.',
      type: IncidentsOverviewResponseSwagger,
    }),
    ApiBadRequestResponse({
      description: 'Invalid date range query.',
    }),
  );
}

export class OutletFeedbackSummaryItemSwagger {
  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'MongoDB ObjectId of the outlet',
  })
  outletId: string;

  @ApiProperty({
    example: 'Outlet 1',
    description: 'Outlet name',
  })
  outletName: string;

  @ApiProperty({
    example: 4,
    description:
      'Negative feedbacks in selected period (complaints or overallRating < 2.5)',
  })
  negativeFeedbacks: number;

  @ApiProperty({
    example: 12,
    description: 'Total feedback received in selected period',
  })
  totalFeedbacks: number;

  @ApiProperty({
    example: 3,
    description: 'Resolved complaints in selected period',
  })
  resolvedFeedbacks: number;
}

export class OutletFeedbackSummaryResponseSwagger {
  @ApiProperty({ type: [OutletFeedbackSummaryItemSwagger] })
  items: OutletFeedbackSummaryItemSwagger[];

  @ApiProperty({
    type: [OutletFeedbackSummaryItemSwagger],
    description: 'Items sorted by negativeFeedbacks (desc)',
  })
  negativeFeedbacksRanked: OutletFeedbackSummaryItemSwagger[];

  @ApiProperty({
    type: [OutletFeedbackSummaryItemSwagger],
    description: 'Items sorted by totalFeedbacks (desc)',
  })
  totalFeedbacksRanked: OutletFeedbackSummaryItemSwagger[];

  @ApiProperty({
    type: [OutletFeedbackSummaryItemSwagger],
    description: 'Items sorted by resolvedFeedbacks (desc)',
  })
  resolvedFeedbacksRanked: OutletFeedbackSummaryItemSwagger[];

  @ApiPropertyOptional({
    example: AnalyticsPeriod.WEEKLY,
    enum: AnalyticsPeriod,
    description: 'Applied preset period when provided',
  })
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({
    example: '2026-02-10T00:00:00.000Z',
    description: 'Applied date range start',
  })
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-03-10T23:59:59.999Z',
    description: 'Applied date range end',
  })
  endDate?: string;
}

export function ApiReviewOutletFeedbackSummary() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get outlet feedback summary',
      description:
        'Returns per-outlet counts for negative feedbacks, total feedback received, and resolved feedbacks.',
    }),
    ApiOkResponse({
      description: 'Outlet feedback summary fetched successfully.',
      type: OutletFeedbackSummaryResponseSwagger,
    }),
    ApiBadRequestResponse({
      description: 'Invalid date range query.',
    }),
  );
}

export class PeakIncidentTimeSwagger {
  @ApiProperty({
    example: '03:00 PM - 06:00 PM (Afternoon Window)',
    description: 'Peak incident time window in IST (12-hour format)',
  })
  label: string;

  @ApiProperty({ example: '03:00 PM' })
  startTime: string;

  @ApiProperty({ example: '06:00 PM' })
  endTime: string;

  @ApiProperty({ example: 'IST' })
  timeZone: string;

  @ApiProperty({ example: 8 })
  totalIncidents: number;
}

export class MostImprovedOutletSwagger {
  @ApiPropertyOptional({
    example: '60d5ecb86217152c9043e02d',
    description: 'MongoDB ObjectId of the outlet',
  })
  outletId?: string | null;

  @ApiProperty({ example: 'Outlet 1' })
  outletName: string;

  @ApiProperty({ example: 0.6 })
  improvement: number;

  @ApiProperty({ example: 3.4 })
  currentAverage: number;

  @ApiProperty({ example: 2.8 })
  previousAverage: number;
}

export class CriticalFocusAreaSwagger {
  @ApiPropertyOptional({
    example: '60d5ecb86217152c9043e02d',
    description: 'MongoDB ObjectId of the outlet',
  })
  outletId?: string | null;

  @ApiProperty({ example: 'Outlet 2' })
  outletName: string;

  @ApiProperty({ example: 2 })
  criticalIssues: number;
}

export class QuickInsightsResponseSwagger {
  @ApiProperty({ type: PeakIncidentTimeSwagger })
  peakIncidentTime: PeakIncidentTimeSwagger;

  @ApiProperty({ type: MostImprovedOutletSwagger })
  mostImprovedOutlet: MostImprovedOutletSwagger;

  @ApiProperty({ type: CriticalFocusAreaSwagger })
  criticalFocusArea: CriticalFocusAreaSwagger;

  @ApiPropertyOptional({
    example: AnalyticsPeriod.WEEKLY,
    enum: AnalyticsPeriod,
    description: 'Applied preset period when provided',
  })
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({
    example: '2026-02-10T00:00:00.000Z',
    description: 'Applied date range start',
  })
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-03-10T23:59:59.999Z',
    description: 'Applied date range end',
  })
  endDate?: string;
}

export function ApiReviewQuickInsights() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get quick insights',
      description:
        'Returns peak incident time (IST), most improved outlet, and critical focus area.',
    }),
    ApiOkResponse({
      description: 'Quick insights fetched successfully.',
      type: QuickInsightsResponseSwagger,
    }),
    ApiBadRequestResponse({
      description: 'Invalid date range query.',
    }),
  );
}

export function ApiReviewFranchiseAnalytics() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get franchise analytics',
      description:
        'Returns franchise ranking and metrics heatmap for all outlets.',
    }),
    ApiOkResponse({
      description: 'Franchise analytics fetched successfully.',
      type: FranchiseAnalyticsResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Invalid date range query.',
    }),
  );
}
