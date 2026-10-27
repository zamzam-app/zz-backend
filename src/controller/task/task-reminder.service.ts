import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { Task, TaskDocument } from './entities/task.entity';
import { TaskStatus } from './task.enums';
import { computeTaskAudience } from './task-visibility.util';

const TASK_REMINDER_TIMEZONE = 'Asia/Kolkata';
/**
 * How late a reminder may still be sent after its scheduled moment. Lets a
 * later cron tick catch up when a tick was missed (deploy/restart/slow run)
 * or a send failed and was released for retry, without sending stale reminders.
 */
const REMINDER_CATCHUP_MS = 5 * 60_000;

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

/**
 * A task is due for this reminder when its due time falls in
 * (windowStart, windowEnd], i.e. the reminder's scheduled moment
 * (dueAt - leadMinutes) is at most REMINDER_CATCHUP_MS in the past.
 */
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
  activeOwner?: Types.ObjectId | string | null;
  activeDelegation?: { delegatedTo?: Types.ObjectId | string | null } | null;
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
      reminderWindows[reminderWindows.length - 1].windowEnd,
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

    try {
      // Everyone who can see the task (all admins, assignees),
      // except the creator, who set the deadline themselves.
      const recipients = computeTaskAudience(
        reservedTask,
        await this.usersService.getAdminIds(),
      );
      recipients.delete(reservedTask.createdBy?.toString() ?? '');
      const recipientIds = [...recipients].filter((id) =>
        Types.ObjectId.isValid(id),
      );

      if (recipientIds.length === 0) {
        this.logger.log(
          `Skipping ${reminderWindow.key} reminder for task ${String(task._id)} because it has no eligible recipients.`,
        );
        return;
      }

      const { submitted, tokenCount } =
        await this.notificationsService.sendPushToUsers(
          recipientIds,
          reminderWindow.title,
          reminderWindow.bodyTemplate(task.description ?? 'Task'),
          { type: 'task', taskId: task._id.toString() },
        );

      if (tokenCount === 0) {
        this.logger.log(
          `Skipping ${reminderWindow.key} reminder for task ${String(task._id)} because no recipient push tokens were found.`,
        );
        return;
      }

      if (!submitted) {
        await this.releaseReservation(task._id, reminderWindow, referenceTime);
        return;
      }

      this.logger.log(
        `Sent ${reminderWindow.key} reminder for task ${String(task._id)} to ${tokenCount} token(s).`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ${reminderWindow.key} reminder for task ${String(task._id)}`,
        error,
      );
      await this.releaseReservation(task._id, reminderWindow, referenceTime);
    }
  }

  /**
   * Un-reserves a reminder whose send failed so a later tick can retry it
   * (until the catch-up window closes). Only releases our own reservation.
   */
  private async releaseReservation(
    taskId: Types.ObjectId | string,
    reminderWindow: ReminderWindow,
    reservedAt: Date,
  ): Promise<void> {
    try {
      await this.taskModel
        .updateOne(
          { _id: taskId, [reminderWindow.sentField]: reservedAt },
          { $set: { [reminderWindow.sentField]: null } },
        )
        .exec();
      this.logger.warn(
        `Released ${reminderWindow.key} reminder for task ${String(taskId)} for retry.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to release ${reminderWindow.key} reminder for task ${String(taskId)}`,
        error,
      );
    }
  }

  private buildReminderWindows(referenceTime: Date): ReminderWindow[] {
    return REMINDER_WINDOWS.map((window) => {
      const windowEnd = new Date(
        referenceTime.getTime() + window.leadMinutes * 60_000,
      );

      return {
        ...window,
        windowStart: new Date(windowEnd.getTime() - REMINDER_CATCHUP_MS),
        windowEnd,
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
      dueAt.getTime() > reminderWindow.windowStart.getTime() &&
      dueAt.getTime() <= reminderWindow.windowEnd.getTime()
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
