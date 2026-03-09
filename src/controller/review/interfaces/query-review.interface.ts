import { Review } from '../entities/review.entity';

export interface FindAllReviewsResult {
  data: Review[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
