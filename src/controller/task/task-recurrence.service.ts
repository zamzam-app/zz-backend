import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationsService } from '../../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { Task } from './entities/task.entity';
import { TaskRecurrenceType, TaskStatus } from './task.enums';
import { computeTaskAudience } from './task-visibility.util';
import {
  IST_TIME_ZONE,
  getIstDateParts,
  getIstDayEnd,
  getIstDayStart,
  isIstLastDayOfMonth,
} from '../../util/ist-date.util';

@Injectable()
export class TaskRecurrenceService {
  private readonly logger = new Logger(TaskRecurrenceService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<Task>,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
  ) {}

  // Every day at 00:05 IST. The app follows IST only, so "today", the weekday
  // and the day of the month are all worked out in IST, whatever the server's
  // own timezone is.
  @Cron('5 0 * * *', { timeZone: IST_TIME_ZONE })
  async handleRecurringTasks() {
    this.logger.log('Running recurring tasks job...');
    const now = new Date();
    const { weekday: dayOfWeek, day: dayOfMonth } = getIstDateParts(now);
    const isLastDayOfMonth = isIstLastDayOfMonth(now);

    // Find all recurring tasks
    const recurringTasks = await this.taskModel
      .find({
        isRecurring: true,
        $or: [
          {
            recurrenceType: TaskRecurrenceType.DAILY,
          },
          {
            recurrenceType: TaskRecurrenceType.WEEKLY,
            recurrenceDays: dayOfWeek,
          },
          {
            recurrenceType: TaskRecurrenceType.MONTHLY,
            // If it's the last day of the month, match any recurrenceDay >= today's date
            ...(isLastDayOfMonth
              ? { recurrenceDays: { $gte: dayOfMonth } }
              : { recurrenceDays: dayOfMonth }),
          },
        ],
      })
      .exec();

    this.logger.log(
      `Found ${recurringTasks.length} recurring tasks to process today.`,
    );

    let createdCount = 0;

    for (const template of recurringTasks) {
      // The IST day, for matching idempotency
      const startOfDay = getIstDayStart(now);
      const endOfDay = getIstDayEnd(now);

      // Idempotency check: does this task already exist for today?
      const existingTask = await this.taskModel
        .findOne({
          description: template.description,
          outletId: template.outletId,
          taskCategoryId: template.taskCategoryId,
          dueDate: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
          isRecurring: false, // The generated task is not recurring
        })
        .exec();

      if (existingTask) {
        this.logger.debug(
          `Task for template ${String(template._id)} already generated for today. Skipping.`,
        );
        continue;
      }

      // Duplicate the task
      const newTaskData = {
        description: template.description,
        taskCategoryId: template.taskCategoryId,
        priority: template.priority,
        status: TaskStatus.OPEN,
        dueDate: startOfDay, // Today (IST)
        dueTime: template.dueTime, // Inherit template due time
        isRecurring: false,
        outletId: template.outletId,
        assigneeIds: template.assigneeIds,
        createdBy: template.createdBy,
        // Any existing submissions or completions should not be copied
      };

      try {
        const created = await this.taskModel.create(newTaskData);
        createdCount++;

        await this.notifyNewInstance(created);
      } catch (error) {
        this.logger.error(
          `Failed to create task from template ${String(template._id)}`,
          error,
        );
      }
    }

    this.logger.log(`Successfully created ${createdCount} new task instances.`);
  }

  /**
   * Notifies everyone who can see a generated task, like `TaskService.create`
   * does for an ordinary task: assignees get "New Task Assigned", everyone
   * else (admins) a neutral message. The creator is not notified.
   * Best-effort: a failure is logged and never affects task generation.
   */
  private async notifyNewInstance(
    task: Task & { _id: unknown },
  ): Promise<void> {
    const taskId = String(task._id);

    try {
      const audience = computeTaskAudience(
        task,
        await this.usersService.getAdminIds(),
      );
      audience.delete(task.createdBy?.toString() ?? '');

      const assigneeSet = new Set(
        (task.assigneeIds ?? []).map((id) => id.toString()),
      );
      const assigned = [...audience].filter((id) => assigneeSet.has(id));
      const others = [...audience].filter((id) => !assigneeSet.has(id));
      const data = { type: 'task', taskId };

      if (assigned.length > 0) {
        await this.notificationsService.sendPushToUsers(
          assigned,
          'New Task Assigned',
          `You've been assigned a task: ${task.description}`,
          data,
        );
      }
      if (others.length > 0) {
        await this.notificationsService.sendPushToUsers(
          others,
          'New Task',
          `New recurring task: ${task.description}`,
          data,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send recurring task notification for task ${taskId}`,
        error,
      );
    }
  }
}
