import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Task, TaskDocument } from '../controller/task/entities/task.entity';
import { TaskStatus } from '../controller/task/task.enums';

async function migrate() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const taskModel = app.get<Model<TaskDocument>>(getModelToken(Task.name));

  // Map ASSIGNED, IN_PROGRESS, READY_FOR_REVIEW to OPEN
  const legacyStatuses = ['ASSIGNED', 'IN_PROGRESS', 'READY_FOR_REVIEW'];

  const result = await taskModel.updateMany(
    {
      status: { $in: legacyStatuses },
      isDeleted: false,
    },
    {
      $set: { status: TaskStatus.OPEN },
    },
  );

  console.log(`Migrated ${result.modifiedCount} tasks to OPEN status.`);
  await app.close();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
