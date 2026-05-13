import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './entities/task.entity';
import { TaskStatus } from './task.enums';
import { NotificationsService } from '../../notifications/notifications.service';
import { User, UserDocument } from '../users/entities/user.entity';

@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  @Cron('* * * * *') // Run every minute
  async handleReminders() {
    try {
      // Calculate target time: current time + 30 minutes
      const now = new Date();
      const targetTime = new Date(now.getTime() + 30 * 60000);

      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(targetTime);
      const getPart = (type: string) =>
        parts.find((p) => p.type === type)?.value || '';

      const year = getPart('year');
      const month = getPart('month');
      const day = getPart('day');
      let hour = getPart('hour');
      const minute = getPart('minute');

      // Fix for midnight in some Node versions where hour12: false returns "24"
      if (hour === '24') {
        hour = '00';
      }

      const targetDateString = `${year}-${month}-${day}`;
      const targetDueTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

      // Node.js will parse "YYYY-MM-DD" as UTC midnight, matching how CreateTaskDto stores dueDate
      const targetDueDate = new Date(targetDateString);

      const tasks = await this.taskModel
        .find({
          isDeleted: false,
          status: TaskStatus.OPEN,
          dueDate: targetDueDate,
          dueTime: targetDueTime,
        })
        .exec();

      if (tasks.length === 0) return;

      this.logger.log(
        `Found ${tasks.length} tasks due at ${targetDateString} ${targetDueTime}`,
      );

      for (const task of tasks) {
        // Find users to notify (assignees, fallback to creator)
        let userIdsToNotify = task.assigneeIds.map((id) => id.toString());
        if (userIdsToNotify.length === 0) {
          userIdsToNotify = [task.createdBy.toString()];
        }

        const users = await this.userModel.find({
          _id: { $in: userIdsToNotify.map((id) => new Types.ObjectId(id)) },
          pushToken: { $ne: null },
        });

        const tokens = users.map((u) => u.pushToken as string).filter(Boolean);
        if (tokens.length > 0) {
          await this.notificationsService.sendPush(
            tokens,
            'Task Due Soon',
            `'${task.description}' is due in 30 minutes.`,
            { type: 'task', taskId: task._id.toString() },
          );
        }
      }
    } catch (error) {
      this.logger.error('Error in handleReminders cron job', error);
    }
  }
}
