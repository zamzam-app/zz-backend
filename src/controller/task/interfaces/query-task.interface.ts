import { TaskPriority, TaskStatus } from '../task.enums';

export interface TaskAttachments {
  images: string[];
  videos: string[];
  audios: string[];
  files: string[];
}

export interface TaskSubmission {
  text?: string;
  attachments: TaskAttachments;
  createdBy: { _id: string; name?: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskBoardItem {
  _id: string;
  description: string;
  taskCategory: { _id: string; name: string; description?: string };
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date;
  dueTime: string;
  adminSubmission?: TaskSubmission;
  managerSubmission?: TaskSubmission;
  outlet: { _id: string; name: string } | null;
  assignees: Array<{ _id: string; name?: string }>;
  createdBy: { _id: string; name?: string };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
}

export interface FindAllTasksResult {
  data: TaskBoardItem[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
