import { OutletTable } from '../entities/outlet-table.entity';

export interface FindAllOutletTablesResult {
  data: OutletTable[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
