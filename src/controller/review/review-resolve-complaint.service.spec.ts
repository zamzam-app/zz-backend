import { Types } from 'mongoose';
import { ComplaintStatus } from './entities/review.entity';
import { ReviewService } from './review.service';

jest.mock('../../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

describe('ReviewService resolveComplaint notifications', () => {
  let service: ReviewService;
  let reviewModel: { findOneAndUpdate: jest.Mock };
  let userModel: { find: jest.Mock; findById: jest.Mock };
  let outletModel: { findById: jest.Mock };
  let usersService: { getPushTokensForUsers: jest.Mock };
  let notificationsService: { sendPush: jest.Mock };

  const reviewId = new Types.ObjectId();
  const outletId = new Types.ObjectId();
  const adminId = new Types.ObjectId();
  const managerId = new Types.ObjectId();

  const mockPreviousStatus = (status?: ComplaintStatus) => {
    // findOneAndUpdate with `new: false` resolves to the pre-update document.
    reviewModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: reviewId,
        outletId,
        complaintStatus: status,
      }),
    });
  };

  const resolveWith = (complaintStatus: ComplaintStatus) =>
    service.resolveComplaint(reviewId.toString(), {
      complaintStatus,
      resolvedBy: managerId.toString(),
    });

  beforeEach(() => {
    reviewModel = { findOneAndUpdate: jest.fn() };
    userModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
      }),
      findById: jest.fn().mockResolvedValue({ name: 'Manager One' }),
    };
    outletModel = {
      findById: jest.fn().mockResolvedValue({ name: 'Outlet A' }),
    };
    usersService = {
      getPushTokensForUsers: jest
        .fn()
        .mockResolvedValue(['ExponentPushToken[admin]']),
    };
    notificationsService = { sendPush: jest.fn().mockResolvedValue(undefined) };

    service = new ReviewService(
      reviewModel as never,
      {} as never,
      {} as never,
      {} as never,
      userModel as never,
      outletModel as never,
      {} as never,
      usersService as never,
      {} as never,
      notificationsService as never,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
  });

  it('requests the pre-update document so the previous status can be compared', async () => {
    mockPreviousStatus(ComplaintStatus.PENDING);

    await resolveWith(ComplaintStatus.RESOLVED);

    expect(reviewModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ new: false }),
    );
  });

  it('notifies admins when a pending complaint becomes resolved', async () => {
    mockPreviousStatus(ComplaintStatus.PENDING);

    await resolveWith(ComplaintStatus.RESOLVED);

    expect(notificationsService.sendPush).toHaveBeenCalledTimes(1);
    expect(notificationsService.sendPush).toHaveBeenCalledWith(
      ['ExponentPushToken[admin]'],
      'Complaint Resolved',
      'A complaint at Outlet A has been resolved by Manager One.',
      { type: 'complaint', reviewId: reviewId.toString() },
    );
  });

  it('does not notify again when the complaint was already resolved', async () => {
    mockPreviousStatus(ComplaintStatus.RESOLVED);

    await resolveWith(ComplaintStatus.RESOLVED);

    expect(notificationsService.sendPush).not.toHaveBeenCalled();
  });

  it('does not notify when the complaint is dismissed', async () => {
    mockPreviousStatus(ComplaintStatus.PENDING);

    await resolveWith(ComplaintStatus.DISMISSED);

    expect(notificationsService.sendPush).not.toHaveBeenCalled();
  });
});
