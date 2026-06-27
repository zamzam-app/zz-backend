import { Types } from 'mongoose';
import { UserRole } from '../users/interfaces/user.interface';
import { TaskReminderService } from './task-reminder.service';

jest.mock('../../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

describe('TaskReminderService', () => {
  let service: TaskReminderService;
  let taskModel: {
    find: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let userModel: {
    find: jest.Mock;
  };
  let usersService: {
    getPushTokensForUsers: jest.Mock;
  };
  let notificationsService: {
    sendPush: jest.Mock;
  };

  const createQueryMock = <T>(value: T) => ({
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(value),
    }),
  });

  const createTask = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    description: 'Close the outlet',
    dueDate: new Date('2026-05-18T00:00:00.000Z'),
    dueTime: '14:30',
    assigneeIds: [new Types.ObjectId()],
    reminderNotifications: {
      oneHourSentAt: null,
      thirtyMinutesSentAt: null,
    },
    ...overrides,
  });

  beforeEach(() => {
    taskModel = {
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    userModel = {
      find: jest.fn(),
    };
    usersService = {
      getPushTokensForUsers: jest.fn().mockResolvedValue([]),
    };
    notificationsService = {
      sendPush: jest.fn().mockResolvedValue(undefined),
    };

    service = new TaskReminderService(
      taskModel as never,
      userModel as never,
      usersService as never,
      notificationsService as never,
    );
  });

  it('sends a 1-hour reminder to manager assignees', async () => {
    const task = createTask();
    const managerId = task.assigneeIds[0];

    taskModel.find.mockReturnValue(createQueryMock([task]));
    taskModel.findOneAndUpdate.mockReturnValue(createQueryMock(task));
    userModel.find.mockReturnValue(
      createQueryMock([
        {
          _id: managerId,
          role: UserRole.MANAGER,
        },
      ]),
    );
    usersService.getPushTokensForUsers.mockResolvedValue([
      'ExponentPushToken[manager-hour]',
    ]);

    await service.handleReminders(new Date('2026-05-18T08:00:00.000Z'));

    expect(notificationsService.sendPush).toHaveBeenCalledWith(
      ['ExponentPushToken[manager-hour]'],
      'Task Due In 1 Hour',
      "'Close the outlet' is due in 1 hour.",
      { type: 'task', taskId: task._id.toString() },
    );
  });

  it('sends a 30-minute reminder to manager assignees', async () => {
    const task = createTask({ dueTime: '15:30' });
    const managerId = task.assigneeIds[0];

    taskModel.find.mockReturnValue(createQueryMock([task]));
    taskModel.findOneAndUpdate.mockReturnValue(createQueryMock(task));
    userModel.find.mockReturnValue(
      createQueryMock([
        {
          _id: managerId,
          role: UserRole.MANAGER,
        },
      ]),
    );
    usersService.getPushTokensForUsers.mockResolvedValue([
      'ExponentPushToken[manager-half-hour]',
    ]);

    await service.handleReminders(new Date('2026-05-18T09:30:00.000Z'));

    expect(notificationsService.sendPush).toHaveBeenCalledWith(
      ['ExponentPushToken[manager-half-hour]'],
      'Task Due In 30 Minutes',
      "'Close the outlet' is due in 30 minutes.",
      { type: 'task', taskId: task._id.toString() },
    );
  });

  it('delivers reminders only to managers', async () => {
    const managerId = new Types.ObjectId();
    const adminId = new Types.ObjectId();
    const task = createTask({ assigneeIds: [managerId, adminId] });

    taskModel.find.mockReturnValue(createQueryMock([task]));
    taskModel.findOneAndUpdate.mockReturnValue(createQueryMock(task));
    userModel.find.mockReturnValue(
      createQueryMock([
        {
          _id: managerId,
          role: UserRole.MANAGER,
        },
      ]),
    );
    usersService.getPushTokensForUsers.mockResolvedValue([
      'ExponentPushToken[manager-only]',
    ]);

    await service.handleReminders(new Date('2026-05-18T08:00:00.000Z'));

    expect(userModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.MANAGER,
      }),
    );
    expect(notificationsService.sendPush).toHaveBeenCalledWith(
      ['ExponentPushToken[manager-only]'],
      'Task Due In 1 Hour',
      "'Close the outlet' is due in 1 hour.",
      { type: 'task', taskId: task._id.toString() },
    );
  });

  it('excludes admin-only assignees from reminders', async () => {
    const adminId = new Types.ObjectId();
    const task = createTask({ assigneeIds: [adminId] });

    taskModel.find.mockReturnValue(createQueryMock([task]));
    taskModel.findOneAndUpdate.mockReturnValue(createQueryMock(task));
    userModel.find.mockReturnValue(createQueryMock([]));

    await service.handleReminders(new Date('2026-05-18T08:00:00.000Z'));

    expect(userModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.MANAGER,
      }),
    );
    expect(notificationsService.sendPush).not.toHaveBeenCalled();
  });

  it('prevents duplicate reminders for the same task window', async () => {
    const task = createTask();
    const managerId = task.assigneeIds[0];

    taskModel.find.mockReturnValue(createQueryMock([task]));
    taskModel.findOneAndUpdate
      .mockReturnValueOnce(createQueryMock(task))
      .mockReturnValueOnce(createQueryMock(null));
    userModel.find.mockReturnValue(
      createQueryMock([
        {
          _id: managerId,
          role: UserRole.MANAGER,
        },
      ]),
    );
    usersService.getPushTokensForUsers.mockResolvedValue([
      'ExponentPushToken[dedupe]',
    ]);

    const referenceTime = new Date('2026-05-18T08:00:00.000Z');

    await service.handleReminders(referenceTime);
    await service.handleReminders(referenceTime);

    expect(notificationsService.sendPush).toHaveBeenCalledTimes(1);
  });

  it('skips tasks without due dates', async () => {
    const task = createTask({ dueDate: null });

    taskModel.find.mockReturnValue(createQueryMock([task]));

    await service.handleReminders(new Date('2026-05-18T08:00:00.000Z'));

    expect(taskModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(userModel.find).not.toHaveBeenCalled();
    expect(notificationsService.sendPush).not.toHaveBeenCalled();
  });
});
