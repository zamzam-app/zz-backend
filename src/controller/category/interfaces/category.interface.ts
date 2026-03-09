export interface CategoryDb {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
