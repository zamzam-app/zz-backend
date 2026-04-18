import { OutletWithReviewMetrics } from './outlet.interface';

export interface FindAllOutletsResult {
  data: OutletWithReviewMetrics[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
