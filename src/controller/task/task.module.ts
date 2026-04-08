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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Outlet.name, schema: OutletSchema },
      { name: TaskCategory.name, schema: TaskCategorySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
