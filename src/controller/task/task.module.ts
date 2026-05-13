import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Outlet, OutletSchema } from '../outlet/entities/outlet.entity';
import {
  TaskCategory,
  TaskCategorySchema,
} from '../task-category/entities/task-category.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { Task, TaskSchema } from './entities/task.entity';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskRecurrenceService } from './task-recurrence.service';
import { TaskReminderService } from './task-reminder.service';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Outlet.name, schema: OutletSchema },
      { name: TaskCategory.name, schema: TaskCategorySchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskRecurrenceService, TaskReminderService],
  exports: [TaskService],
})
export class TaskModule {}
