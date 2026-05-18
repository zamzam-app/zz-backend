export interface PricingOption {
  quantityValue: number;
  quantityUnit: string;
  amount: number;
  currency: string;
}

export interface ProductDb {
  _id: string;
  name: string;
  pricing: PricingOption[];
  description: string;
  images: string[];
  categoryList: string[];
  isActive: boolean;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
