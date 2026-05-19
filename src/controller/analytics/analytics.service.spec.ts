import { AnalyticsService } from './analytics.service';
import { AnalyticsPeriod } from '../review/dto/query-global-csat.dto';
import { ComplaintStatus } from '../review/entities/review.entity';

describe('AnalyticsService review filtering', () => {
  let service: AnalyticsService;
  let reviewModel: {
    aggregate: jest.Mock;
  };
  let outletModel: {
    aggregate: jest.Mock;
  };

  beforeEach(() => {
    reviewModel = {
      aggregate: jest.fn(),
    };
    outletModel = {
      aggregate: jest.fn(),
    };

    service = new AnalyticsService(reviewModel as never, outletModel as never);
  });

  it('excludes resolved critical reviews from quick insights critical focus', async () => {
    reviewModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    await (service as any).getCriticalFocusArea({});

    const pipeline = reviewModel.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({
      $match: {
        isDeleted: false,
        isComplaint: true,
        overallRating: { $lt: 2 },
        $or: [
          { complaintStatus: { $exists: false } },
          { complaintStatus: null },
          {
            complaintStatus: {
              $nin: ['resolved', 'dismissed', 'closed', 'completed'],
            },
          },
        ],
      },
    });
  });

  it('returns a zero-state focus area when no unresolved critical reviews exist', async () => {
    reviewModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    const result = await (service as any).getCriticalFocusArea({});

    expect(result).toEqual({
      outletId: null,
      outletName: 'Unknown Outlet',
      criticalIssues: 0,
    });
  });

  it('applies the unresolved review scope to daily incidents overview counts', async () => {
    reviewModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          totalOpenIncidents: [{ count: 3 }],
          criticalIssues: [{ count: 1 }],
          incidentsResolvedToday: [{ count: 2 }],
        },
      ]),
    });

    const result = await service.getIncidentsOverview({
      period: AnalyticsPeriod.DAILY,
    });

    const pipeline = reviewModel.aggregate.mock.calls[0][0];
    const totalOpenMatch = pipeline[0].$facet.totalOpenIncidents[0].$match;
    const criticalMatch = pipeline[0].$facet.criticalIssues[0].$match;

    expect(totalOpenMatch.isComplaint).toBe(true);
    expect(totalOpenMatch.$or).toEqual([
      { complaintStatus: { $exists: false } },
      { complaintStatus: null },
      {
        complaintStatus: {
          $nin: ['resolved', 'dismissed', 'closed', 'completed'],
        },
      },
    ]);
    expect(totalOpenMatch.createdAt).toBeDefined();
    expect(criticalMatch.overallRating).toEqual({ $lt: 2 });
    expect(result.totalOpenIncidents).toBe(3);
    expect(result.criticalIssues).toBe(1);
    expect(result.incidentsResolvedToday).toBe(2);
  });

  it('applies the unresolved review scope to weekly incidents overview counts', async () => {
    reviewModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          totalOpenIncidents: [],
          criticalIssues: [],
          incidentsResolvedToday: [],
        },
      ]),
    });

    await service.getIncidentsOverview({
      period: AnalyticsPeriod.WEEKLY,
    });

    const pipeline = reviewModel.aggregate.mock.calls[0][0];
    const totalOpenMatch = pipeline[0].$facet.totalOpenIncidents[0].$match;

    expect(totalOpenMatch.createdAt).toBeDefined();
    expect(totalOpenMatch.$or).toEqual([
      { complaintStatus: { $exists: false } },
      { complaintStatus: null },
      {
        complaintStatus: {
          $nin: ['resolved', 'dismissed', 'closed', 'completed'],
        },
      },
    ]);
  });

  it('applies the unresolved review scope to monthly incidents overview counts', async () => {
    reviewModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          totalOpenIncidents: [],
          criticalIssues: [],
          incidentsResolvedToday: [],
        },
      ]),
    });

    await service.getIncidentsOverview({
      period: AnalyticsPeriod.MONTHLY,
    });

    const pipeline = reviewModel.aggregate.mock.calls[0][0];
    const totalOpenMatch = pipeline[0].$facet.totalOpenIncidents[0].$match;

    expect(totalOpenMatch.createdAt).toBeDefined();
    expect(totalOpenMatch.$or).toEqual([
      { complaintStatus: { $exists: false } },
      { complaintStatus: null },
      {
        complaintStatus: {
          $nin: ['resolved', 'dismissed', 'closed', 'completed'],
        },
      },
    ]);
  });

  it('applies the unresolved review scope to all-time incidents overview counts', async () => {
    reviewModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          totalOpenIncidents: [],
          criticalIssues: [],
          incidentsResolvedToday: [],
        },
      ]),
    });

    await service.getIncidentsOverview({
      period: AnalyticsPeriod.ALL_TIME,
    });

    const pipeline = reviewModel.aggregate.mock.calls[0][0];
    const totalOpenMatch = pipeline[0].$facet.totalOpenIncidents[0].$match;

    expect(totalOpenMatch.createdAt).toBeUndefined();
    expect(totalOpenMatch.$or).toEqual([
      { complaintStatus: { $exists: false } },
      { complaintStatus: null },
      {
        complaintStatus: {
          $nin: ['resolved', 'dismissed', 'closed', 'completed'],
        },
      },
    ]);
  });

  it('keeps outlet feedback totals aligned to open-review counts', async () => {
    outletModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          outletId: 'outlet-1',
          outletName: 'Outlet 1',
          totalFeedbacks: 4,
          negativeFeedbacks: 2,
          resolvedFeedbacks: 1,
        },
      ]),
    });

    const result = await service.getOutletFeedbackSummary({
      period: AnalyticsPeriod.MONTHLY,
    });

    const pipeline = outletModel.aggregate.mock.calls[0][0];
    const feedbackFacet = pipeline[2].$lookup.pipeline[1].$facet;

    expect(feedbackFacet.totalFeedbacks[0].$match).toEqual({
      isDeleted: false,
      isComplaint: true,
      createdAt: expect.any(Object),
      $or: [
        { complaintStatus: { $exists: false } },
        { complaintStatus: null },
        {
          complaintStatus: {
            $nin: ['resolved', 'dismissed', 'closed', 'completed'],
          },
        },
      ],
    });
    expect(feedbackFacet.negativeFeedbacks[0].$match).toEqual({
      isDeleted: false,
      isComplaint: true,
      createdAt: expect.any(Object),
      overallRating: { $lt: 2.5 },
      $or: [
        { complaintStatus: { $exists: false } },
        { complaintStatus: null },
        {
          complaintStatus: {
            $nin: ['resolved', 'dismissed', 'closed', 'completed'],
          },
        },
      ],
    });
    expect(feedbackFacet.resolvedFeedbacks[0].$match).toEqual({
      isComplaint: true,
      complaintStatus: ComplaintStatus.RESOLVED,
      resolvedAt: expect.any(Object),
    });
    expect(result.items).toEqual([
      {
        outletId: 'outlet-1',
        outletName: 'Outlet 1',
        totalFeedbacks: 4,
        negativeFeedbacks: 2,
        resolvedFeedbacks: 1,
      },
    ]);
    expect(result.totalFeedbacksRanked[0].totalFeedbacks).toBe(4);
    expect(result.negativeFeedbacksRanked[0].negativeFeedbacks).toBe(2);
  });
});
