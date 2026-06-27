import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../../notifications/notifications.service';
import { User, UserDocument } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/interfaces/user.interface';
import { Task, TaskDocument } from './entities/task.entity';
import { TaskStatus } from './task.enums';

const TASK_REMINDER_TIMEZONE = 'Asia/Kolkata';
const REMINDER_JOB_INTERVAL_MS = 60_000;

type ReminderWindowConfig = {
  key: 'oneHour' | 'thirtyMinutes' | 'exactDeadline';
  leadMinutes: number;
  title: string;
  /** Receives the task description and returns the full notification body. */
  bodyTemplate: (description: string) => string;
  sentField:
    | 'reminderNotifications.oneHourSentAt'
    | 'reminderNotifications.thirtyMinutesSentAt'
    | 'reminderNotifications.exactDeadlineSentAt';
};

type ReminderWindow = ReminderWindowConfig & {
  windowStart: Date;
  windowEnd: Date;
};

const REMINDER_WINDOWS: ReminderWindowConfig[] = [
  {
    key: 'oneHour',
    leadMinutes: 60,
    title: 'Task Due In 1 Hour',
    bodyTemplate: (desc) => `'${desc}' is due in 1 hour.`,
    sentField: 'reminderNotifications.oneHourSentAt',
  },
  {
    key: 'thirtyMinutes',
    leadMinutes: 30,
    title: 'Task Due In 30 Minutes',
    bodyTemplate: (desc) => `'${desc}' is due in 30 minutes.`,
    sentField: 'reminderNotifications.thirtyMinutesSentAt',
  },
  {
    key: 'exactDeadline',
    leadMinutes: 0,
    title: 'Task Due Now',
    bodyTemplate: (desc) => `'${desc}' is due now.`,
    sentField: 'reminderNotifications.exactDeadlineSentAt',
  },
];

type TaskReminderCandidate = {
  _id: Types.ObjectId | string;
  description?: string;
  dueDate?: Date | null;
  dueTime?: string | null;
  assigneeIds?: Array<Types.ObjectId | string>;
  createdBy?: Types.ObjectId | string;
  reminderNotifications?: {
    oneHourSentAt?: Date | null;
    thirtyMinutesSentAt?: Date | null;
    exactDeadlineSentAt?: Date | null;
  };
};

@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
  ) {}

  @Cron('* * * * *')
  async handleReminders(referenceTime: Date = new Date()) {
    try {
      const reminderWindows = this.buildReminderWindows(referenceTime);
      const tasks = await this.findCandidateTasks(reminderWindows);

      if (tasks.length === 0) {
        return;
      }

      for (const task of tasks) {
        const dueAt = this.getTaskDueDateTime(task);
        if (!dueAt) {
          continue;
        }

        for (const reminderWindow of reminderWindows) {
          if (!this.isDueInReminderWindow(dueAt, reminderWindow)) {
            continue;
          }

          await this.sendReminderForWindow(task, reminderWindow, referenceTime);
        }
      }
    } catch (error) {
      this.logger.error('Error in handleReminders cron job', error);
    }
  }

  private async findCandidateTasks(
    reminderWindows: ReminderWindow[],
  ): Promise<TaskReminderCandidate[]> {
    const searchStart = this.getBusinessDayStart(
      reminderWindows[0].windowStart,
    );
    const searchEnd = this.getBusinessDayEnd(
      reminderWindows[reminderWindows.length - 1].windowStart,
    );

    return this.taskModel
      .find({
        isDeleted: false,
        status: TaskStatus.OPEN,
        dueDate: {
          $gte: searchStart,
          $lte: searchEnd,
        },
        dueTime: { $exists: true, $ne: null },
        $or: REMINDER_WINDOWS.map((window) => ({ [window.sentField]: null })),
      })
      .lean()
      .exec();
  }

  private async sendReminderForWindow(
    task: TaskReminderCandidate,
    reminderWindow: ReminderWindow,
    referenceTime: Date,
  ): Promise<void> {
    const reservedTask = await this.taskModel
      .findOneAndUpdate(
        {
          _id: task._id,
          isDeleted: false,
          status: TaskStatus.OPEN,
          [reminderWindow.sentField]: null,
        },
        {
          $set: {
            [reminderWindow.sentField]: referenceTime,
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!reservedTask) {
      return;
    }

    const creatorId = reservedTask.createdBy?.toString();
    const assigneeIds = (reservedTask.assigneeIds ?? [])
      .map((id) => id.toString())
      .filter((id) => Types.ObjectId.isValid(id) && id !== creatorId);

    if (assigneeIds.length === 0) {
      this.logger.log(
        `Skipping ${reminderWindow.key} reminder for task ${String(task._id)} because it has no eligible assignees.`,
      );
      return;
    }

    const managers = await this.userModel
      .find(
        {
          _id: { $in: assigneeIds.map((id) => new Types.ObjectId(id)) },
          isDeleted: false,
          role: UserRole.MANAGER,
        },
        '_id',
      )
      .lean()
      .exec();

    const managerIds = managers.map((m) => m._id.toString());

    if (managerIds.length === 0) {
      this.logger.log(
        `Skipping ${reminderWindow.key} reminder for task ${String(task._id)} because it has no manager assignees.`,
      );
      return;
    }

    const tokens = await this.usersService.getPushTokensForUsers(managerIds);

    if (tokens.length === 0) {
      this.logger.log(
        `Skipping ${reminderWindow.key} reminder for task ${String(task._id)} because no manager push tokens were found.`,
      );
      return;
    }

    try {
      await this.notificationsService.sendPush(
        tokens,
        reminderWindow.title,
        reminderWindow.bodyTemplate(task.description ?? 'Task'),
        { type: 'task', taskId: task._id.toString() },
      );

      this.logger.log(
        `Sent ${reminderWindow.key} reminder for task ${String(task._id)} to ${tokens.length} manager(s).`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ${reminderWindow.key} reminder for task ${String(task._id)}`,
        error,
      );
    }
  }

  private buildReminderWindows(referenceTime: Date): ReminderWindow[] {
    return REMINDER_WINDOWS.map((window) => {
      const windowStart = new Date(
        referenceTime.getTime() + window.leadMinutes * 60_000,
      );

      return {
        ...window,
        windowStart,
        windowEnd: new Date(windowStart.getTime() + REMINDER_JOB_INTERVAL_MS),
      };
    }).sort(
      (left, right) => left.windowStart.getTime() - right.windowStart.getTime(),
    );
  }

  private isDueInReminderWindow(
    dueAt: Date,
    reminderWindow: ReminderWindow,
  ): boolean {
    return (
      dueAt.getTime() >= reminderWindow.windowStart.getTime() &&
      dueAt.getTime() < reminderWindow.windowEnd.getTime()
    );
  }

  private getTaskDueDateTime(task: TaskReminderCandidate): Date | null {
    if (
      !(task.dueDate instanceof Date) ||
      Number.isNaN(task.dueDate.getTime())
    ) {
      return null;
    }

    if (
      typeof task.dueTime !== 'string' ||
      !/^([01]\d|2[0-3]):([0-5]\d)$/.test(task.dueTime)
    ) {
      return null;
    }

    const [hours, minutes] = task.dueTime.split(':').map(Number);
    const { year, month, day } = this.getDatePartsInTimeZone(task.dueDate);

    return this.createDateInTimeZone(year, month, day, hours, minutes);
  }

  private getBusinessDayStart(date: Date): Date {
    const { year, month, day } = this.getDatePartsInTimeZone(date);
    return this.createDateInTimeZone(year, month, day, 0, 0);
  }

  private getBusinessDayEnd(date: Date): Date {
    const nextDayStart = new Date(this.getBusinessDayStart(date));
    nextDayStart.setUTCDate(nextDayStart.getUTCDate() + 1);
    return new Date(nextDayStart.getTime() - 1);
  }

  private createDateInTimeZone(
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
  ): Date {
    const utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
    const initialOffsetMinutes = this.getTimeZoneOffsetMinutes(
      new Date(utcGuess),
    );
    let utcTime = utcGuess - initialOffsetMinutes * 60_000;

    const correctedOffsetMinutes = this.getTimeZoneOffsetMinutes(
      new Date(utcTime),
    );
    if (correctedOffsetMinutes !== initialOffsetMinutes) {
      utcTime = utcGuess - correctedOffsetMinutes * 60_000;
    }

    return new Date(utcTime);
  }

  private getDatePartsInTimeZone(date: Date): {
    year: number;
    month: number;
    day: number;
  } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TASK_REMINDER_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);

    return {
      year: Number(parts.find((part) => part.type === 'year')?.value ?? 0),
      month: Number(parts.find((part) => part.type === 'month')?.value ?? 0),
      day: Number(parts.find((part) => part.type === 'day')?.value ?? 0),
    };
  }

  private getTimeZoneOffsetMinutes(date: Date): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TASK_REMINDER_TIMEZONE,
      timeZoneName: 'shortOffset',
    });
    const offsetText =
      formatter
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')
        ?.value.replace('GMT', '') ?? '+00:00';
    const sign = offsetText.startsWith('-') ? -1 : 1;
    const [hours, minutes = '0'] = offsetText.replace(/[+-]/, '').split(':');

    return sign * (Number(hours) * 60 + Number(minutes));
  }
}
