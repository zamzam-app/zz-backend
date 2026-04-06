import { TaskCategory, TaskPriority, TaskStatus } from '../task.enums';

export interface TaskBoardItem {
  _id: string;
  description: string;
  comment?: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date;
  imageUrls?: string[];
  videoUrls?: string[];
  adminAudioUrl?: string[];
  managerAudioUrl?: string[];
  managerComments?: string;
  outlet: { _id: string; name: string };
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
