export interface IOutletMenuItem {
  productId: string;
  isAvailable: boolean;
}

export interface IOutlet {
  _id?: string;
  outletType: string;
  name: string;
  description: string;
  images: string[];
  qrToken: string;
  isActive?: boolean;
  isDeleted?: boolean;
  managerId?: string | null;
  formId?: string | null;
  addressId?: string;
  address?: string;
  menuItems?: IOutletMenuItem[];
  productTemplateId?: string;
  googleMapsLink?: string;
  tables?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
