export interface ProductDb {
  _id: string;
  name: string;
  price: number;
  description: string;
  images: string[];
  isActive: boolean;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
