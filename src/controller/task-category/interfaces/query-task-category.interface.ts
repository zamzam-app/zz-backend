import { TaskCategory } from '../entities/task-category.entity';

export interface FindAllTaskCategoriesResult {
  data: TaskCategory[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
