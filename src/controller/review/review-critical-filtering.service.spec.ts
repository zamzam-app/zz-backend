import { ReviewService } from './review.service';

jest.mock('../../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

describe('ReviewService critical filtering', () => {
  let service: ReviewService;
  let reviewModel: {
    aggregate: jest.Mock;
  };

  beforeEach(() => {
    reviewModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ data: [], totalCount: [{ count: 0 }] }]),
      }),
    };

    service = new ReviewService(
      reviewModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('builds an unresolved critical reviews match for list queries', async () => {
    await service.findAll({
      severity: 'critical',
      unresolvedOnly: true,
      isComplaint: true,
      page: 1,
    });

    const pipeline = reviewModel.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({
      $match: {
        isDeleted: false,
        isComplaint: true,
        overallRating: { $lt: 2 },
        $or: [
          { complaintStatus: 'pending' },
          { complaintStatus: { $exists: false } },
          { complaintStatus: null },
        ],
      },
    });
  });
});
