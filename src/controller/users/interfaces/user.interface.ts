export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MANAGER = 'manager',
}

export interface UserDb {
  _id: string;
  name?: string;
  role: UserRole;
  addressId?: string;
  email?: string;
  password?: string;
  userName?: string;
  outlets?: string[];
  phoneNumber?: string;
  otp?: string;
  dob?: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  userReviews?: string[];
  custom_cakes?: string[];
}
