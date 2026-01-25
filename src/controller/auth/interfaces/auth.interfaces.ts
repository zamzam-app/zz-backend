import { User } from '../../users/entities/user.entity';
import { Types } from 'mongoose';

export interface JwtPayload {
  name: string;
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
}

export interface LoginResponse extends AuthTokens {
  user: Omit<User, 'password'>;
}

export interface ValidatedUser extends Omit<User, 'password'> {
  _id: Types.ObjectId;
}
