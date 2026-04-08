import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TaskCategory,
  TaskCategorySchema,
} from './entities/task-category.entity';
import { TaskCategoryController } from './task-category.controller';
import { TaskCategoryService } from './task-category.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaskCategory.name, schema: TaskCategorySchema },
    ]),
  ],
  controllers: [TaskCategoryController],
  providers: [TaskCategoryService],
  exports: [TaskCategoryService],
})
export class TaskCategoryModule {}
