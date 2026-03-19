import { CustomCake } from '../entities/custom-cake.entity';

export interface FindAllCustomCakesResult {
  data: CustomCake[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
