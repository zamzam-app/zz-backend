import { UploadedCake } from '../entities/uploaded-cake.entity';

export interface FindAllUploadedCakesResult {
  data: UploadedCake[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
