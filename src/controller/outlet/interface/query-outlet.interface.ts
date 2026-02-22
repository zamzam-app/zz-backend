import { Outlet } from '../entities/outlet.entity';

export interface FindAllOutletsResult {
  data: Outlet[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
