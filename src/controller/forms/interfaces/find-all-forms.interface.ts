import { Form } from '../entities/form.entity';

export interface FindAllFormsResult {
  data: Form[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
