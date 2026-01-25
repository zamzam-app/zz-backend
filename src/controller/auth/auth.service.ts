import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserDocument, UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ValidateUserDto } from './dto/validate-user.dto';
import {
  JwtPayload,
  AuthTokens,
  LoginResponse,
  ValidatedUser,
} from './interfaces/auth.interfaces';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Admin and Manager login
  async signIn(loginDto: LoginDto): Promise<LoginResponse> {
    const user = await this.validateUser({
      pass: loginDto.password,
      name: loginDto.name,
      email: loginDto.email,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new UnauthorizedException(
        'Unauthorized role for this login method',
      );
    }

    return this.login(user);
  }

  // Users OTP login (Auto-registration supported)
  async signInWithOtp(verifyOtpDto: VerifyOtpDto): Promise<LoginResponse> {
    // 1. Initial OTP Check (hardcoded for now)
    if (verifyOtpDto.otp !== '123456') {
      throw new UnauthorizedException('Invalid OTP');
    }

    // 2. Find or Create User
    let userDoc = await this.usersService.findOneByPhoneNumber(
      verifyOtpDto.phoneNumber,
    );

    if (!userDoc) {
      userDoc = await this.usersService.create({
        phoneNumber: verifyOtpDto.phoneNumber,
        role: 'user' as UserRole,
      });
    }

    // 3. Sanitize and Login
    const sanitizedUser = userDoc.toObject();
    delete (sanitizedUser as { password?: string }).password;

    return this.login(sanitizedUser as ValidatedUser);
  }

  async getProfile(userId: string): Promise<ValidatedUser> {
    const userDoc = await this.usersService.findOne(userId);
    const sanitizedUser = userDoc.toObject();
    delete (sanitizedUser as { password?: string }).password;
    return sanitizedUser as ValidatedUser;
  }

  refresh(refreshToken: string): AuthTokens {
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }
    return this.refreshTokens(refreshToken);
  }

  async validateUser(
    validateUserDto: ValidateUserDto,
  ): Promise<ValidatedUser | null> {
    const { pass, name, email } = validateUserDto;
    let user: UserDocument | null = null;
    if (name) {
      user = await this.usersService.findOneByName(name);
    } else if (email) {
      user = await this.usersService.findOneByEmail(email);
    }

    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      const result = user.toObject();
      delete (result as { password?: string }).password;
      return result as ValidatedUser;
    }
    return null;
  }

  login(user: ValidatedUser): LoginResponse {
    const payload: JwtPayload = {
      name: user.name,
      sub: user._id.toString(),
      role: user.role,
    };
    const tokens = this.generateTokens(payload);
    return {
      ...tokens,
      user,
    };
  }

  generateTokens(payload: JwtPayload): AuthTokens {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  refreshTokens(refreshToken: string): AuthTokens {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const newPayload: JwtPayload = {
        name: payload.name,
        sub: payload.sub,
        role: payload.role,
      };

      return this.generateTokens(newPayload);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
