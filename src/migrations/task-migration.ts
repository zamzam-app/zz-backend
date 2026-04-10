import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Task, TaskDocument } from '../controller/task/entities/task.entity';

async function migrate() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const taskModel = app.get<Model<TaskDocument>>(getModelToken(Task.name));

  const tasks = await taskModel.find({
    $or: [
      { adminSubmission: { $exists: false } },
      { managerSubmission: { $exists: false } },
    ],
    isDeleted: false,
  });

  console.log(`Found ${tasks.length} tasks to migrate.`);

  for (const task of tasks) {
    const update: any = {};

    if (!task.adminSubmission) {
      update.adminSubmission = {
        text: '',
        attachments: {
          images: task.imageUrls || [],
          videos: task.videoUrls || [],
          audios: task.adminAudioUrl || [],
          files: [],
        },
        createdBy: task.createdBy,
        createdAt: (task as any).createdAt || new Date(),
        updatedAt: (task as any).updatedAt || new Date(),
      };
    }

    if (!task.managerSubmission) {
      update.managerSubmission = {
        text: task.managerComments || '',
        attachments: {
          images: [],
          videos: [],
          audios: task.managerAudioUrl || [],
          files: [],
        },
        createdBy: task.assigneeIds?.[0] || task.createdBy, // Best effort for legacy
        createdAt: (task as any).createdAt || new Date(),
        updatedAt: (task as any).updatedAt || new Date(),
      };
    }

    await taskModel.updateOne({ _id: task._id }, { $set: update });
  }

  console.log('Migration complete.');
  await app.close();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
