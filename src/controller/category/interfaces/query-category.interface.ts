import { Category } from '../entities/category.entity';

export interface FindAllCategoriesResult {
  data: Category[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
