import { Rating } from '../entities/rating.entity';

export interface FindAllRatingsResult {
  data: Rating[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
