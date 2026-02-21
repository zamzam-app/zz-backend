import { User } from '../entities/user.entity';

export interface FindAllUsersResult {
  data: User[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
