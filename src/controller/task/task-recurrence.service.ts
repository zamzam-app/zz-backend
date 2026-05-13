import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task } from './entities/task.entity';
import { TaskRecurrenceType, TaskStatus } from './task.enums';

@Injectable()
export class TaskRecurrenceService {
  private readonly logger = new Logger(TaskRecurrenceService.name);

  constructor(@InjectModel(Task.name) private taskModel: Model<Task>) {}

  @Cron('0 1 * * *') // Every day at 1:00 AM
  async handleRecurringTasks() {
    this.logger.log('Running recurring tasks job...');
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (Sunday) to 6 (Saturday)
    const dayOfMonth = now.getDate(); // 1 to 31

    // Check if today is the last day of the current month
    const nextDay = new Date(now);
    nextDay.setDate(now.getDate() + 1);
    const isLastDayOfMonth = nextDay.getDate() === 1;

    // Find all recurring tasks
    const recurringTasks = await this.taskModel
      .find({
        isRecurring: true,
        $or: [
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
      // Create date without time for matching idempotency
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      );

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
        dueDate: now, // Set to today
        dueTime: template.dueTime, // Inherit template due time
        isRecurring: false,
        outletId: template.outletId,
        assigneeIds: template.assigneeIds,
        createdBy: template.createdBy,
        // Any existing submissions or completions should not be copied
      };

      try {
        await this.taskModel.create(newTaskData);
        createdCount++;
      } catch (error) {
        this.logger.error(
          `Failed to create task from template ${String(template._id)}`,
          error,
        );
      }
    }

    this.logger.log(`Successfully created ${createdCount} new task instances.`);
  }
}
