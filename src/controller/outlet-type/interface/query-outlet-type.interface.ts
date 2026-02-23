import { OutletType } from '../entities/outlet-type.entity';

export interface FindAllOutletTypesResult {
  data: OutletType[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
