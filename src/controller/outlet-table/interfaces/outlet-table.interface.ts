import { OutletTableStatus } from '../entities/outlet-table.entity';

export interface IOutletTable {
  _id?: string;
  outletId: string;
  createdBy: string;
  name: string;
  tableToken: string;
  capacity?: number;
  status?: OutletTableStatus;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
