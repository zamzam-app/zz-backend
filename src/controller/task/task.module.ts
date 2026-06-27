import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Outlet, OutletSchema } from '../outlet/entities/outlet.entity';
import {
  TaskCategory,
  TaskCategorySchema,
} from '../task-category/entities/task-category.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { Task, TaskSchema } from './entities/task.entity';
import { TaskEvent, TaskEventSchema } from './entities/task-event.entity';
import {
  TaskDelegation,
  TaskDelegationSchema,
} from './entities/task-delegation.entity';
import { TaskView, TaskViewSchema } from './entities/task-view.entity';
import {
  TaskAttachment,
  TaskAttachmentSchema,
} from './entities/task-attachment.entity';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskEventService } from './services/task-event.service';
import { TaskThreadQueryService } from './services/task-thread-query.service';
import { TaskDelegationService } from './services/task-delegation.service';
import { TaskViewService } from './services/task-view.service';
import { TaskAttachmentService } from './services/task-attachment.service';
import { TaskRecurrenceService } from './task-recurrence.service';
import { TaskReminderService } from './task-reminder.service';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: TaskEvent.name, schema: TaskEventSchema },
      { name: TaskDelegation.name, schema: TaskDelegationSchema },
      { name: TaskView.name, schema: TaskViewSchema },
      { name: TaskAttachment.name, schema: TaskAttachmentSchema },
      { name: Outlet.name, schema: OutletSchema },
      { name: TaskCategory.name, schema: TaskCategorySchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [TaskController],
  providers: [
    TaskService,
    TaskEventService,
    TaskThreadQueryService,
    TaskDelegationService,
    TaskViewService,
    TaskAttachmentService,
    TaskRecurrenceService,
    TaskReminderService,
  ],
  exports: [
    TaskService,
    TaskEventService,
    TaskThreadQueryService,
    TaskDelegationService,
    TaskViewService,
    TaskAttachmentService,
  ],
})
export class TaskModule {}
