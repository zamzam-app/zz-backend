import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/interfaces/user.interface';
import { Types } from 'mongoose';

export interface JwtPayload {
  name: string;
  sub: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
}

export interface LoginResponse extends AuthTokens {
  user: Omit<User, 'password'>;
  emailUpdateSkipped?: boolean;
}

export interface ValidatedUser extends Omit<User, 'password'> {
  _id: Types.ObjectId;
}
