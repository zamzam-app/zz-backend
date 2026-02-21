import { Product } from '../entities/product.entity';

export interface FindAllProductsResult {
  data: Product[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
