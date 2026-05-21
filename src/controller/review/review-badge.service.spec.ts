import { Types } from 'mongoose';
import { ComplaintStatus } from './entities/review.entity';
import { ReviewService } from './review.service';
import { UserRole } from '../users/interfaces/user.interface';

jest.mock('../../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

describe('ReviewService badge status', () => {
  let service: ReviewService;
  let reviewModel: {
    countDocuments: jest.Mock;
    findOne: jest.Mock;
    updateOne: jest.Mock;
  };
  let userModel: {
    findOne: jest.Mock;
  };
  let outletModel: {
    find: jest.Mock;
  };

  const createExecMock = <T>(value: T) => ({
    exec: jest.fn().mockResolvedValue(value),
  });

  beforeEach(() => {
    reviewModel = {
      countDocuments: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };
    userModel = {
      findOne: jest.fn(),
    };
    outletModel = {
      find: jest.fn(),
    };

    service = new ReviewService(
      reviewModel as never,
      {} as never,
      {} as never,
      {} as never,
      userModel as never,
      outletModel as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('returns unread pending review badge counts for admin users', async () => {
    const userId = new Types.ObjectId().toString();

    userModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(
          createExecMock({
            _id: new Types.ObjectId(userId),
            role: UserRole.ADMIN,
            outlets: [],
          }),
        ),
      }),
    });
    reviewModel.countDocuments
      .mockReturnValueOnce(createExecMock(5))
      .mockReturnValueOnce(createExecMock(3));

    const result = await service.getBadgeStatus(userId);

    expect(reviewModel.countDocuments).toHaveBeenNthCalledWith(1, {
      isDeleted: false,
      isComplaint: true,
      complaintStatus: ComplaintStatus.PENDING,
    });
    expect(result).toEqual({
      pendingCount: 5,
      unreadCount: 3,
      hasUnread: true,
    });
  });

  it('returns hidden badge state when there are no unread pending reviews', async () => {
    const userId = new Types.ObjectId().toString();
    const outletId = new Types.ObjectId();

    userModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(
          createExecMock({
            _id: new Types.ObjectId(userId),
            role: UserRole.MANAGER,
            outlets: [outletId],
          }),
        ),
      }),
    });
    outletModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(createExecMock([])),
      }),
    });
    reviewModel.countDocuments
      .mockReturnValueOnce(createExecMock(0))
      .mockReturnValueOnce(createExecMock(0));

    const result = await service.getBadgeStatus(userId);

    expect(result).toEqual({
      pendingCount: 0,
      unreadCount: 0,
      hasUnread: false,
    });
  });

  it('updates badge state after a review is viewed or handled', async () => {
    const userId = new Types.ObjectId().toString();
    const reviewId = new Types.ObjectId().toString();
    const outletId = new Types.ObjectId();

    userModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(
          createExecMock({
            _id: new Types.ObjectId(userId),
            role: UserRole.MANAGER,
            outlets: [outletId],
          }),
        ),
      }),
    });
    outletModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(createExecMock([])),
      }),
    });
    reviewModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue(
            createExecMock({ _id: new Types.ObjectId(reviewId) }),
          ),
      }),
    });
    reviewModel.updateOne.mockReturnValue(
      createExecMock({ acknowledged: true }),
    );
    reviewModel.countDocuments
      .mockReturnValueOnce(createExecMock(2))
      .mockReturnValueOnce(createExecMock(1));

    const result = await service.markReviewAsRead(reviewId, userId);

    expect(reviewModel.updateOne).toHaveBeenCalled();
    expect(result).toEqual({
      pendingCount: 2,
      unreadCount: 1,
      hasUnread: true,
    });
  });
});
