import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from '../users/entities/user.entity';
import { UserRole } from '../users/interfaces/user.interface';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { ValidateUserDto } from './dto/validate-user.dto';
import { createOtp } from '../../util/otp.util';
import {
  normalizeEmail,
  normalizePhoneNumber,
} from '../../util/normalize.util';
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

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
      throw new UnauthorizedException(
        'Unauthorized role for this login method',
      );
    }

    await this.usersService.update(user._id.toString(), {
      lastLoginAt: new Date().toISOString(),
    });
    return this.login(user);
  }

  /** Request OTP: find user by phone or create new user, store OTP, return success. */
  async requestOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const normPhone = normalizePhoneNumber(dto.phoneNumber);
    let userDoc: UserDocument | null =
      (await this.usersService.findOneByPhoneNumber(
        normPhone,
      )) as UserDocument | null;

    const otp = createOtp();

    if (userDoc) {
      await this.usersService.setOtp(userDoc._id.toString(), otp);
      return { message: 'OTP sent successfully to your phone number' };
    }

    userDoc = await this.usersService.create({
      phoneNumber: normPhone || dto.phoneNumber,
      role: UserRole.USER,
      otp,
    });
    return { message: 'OTP sent successfully to your phone number' };
  }

  // Users OTP login (Auto-registration supported)
  async signInWithOtp(verifyOtpDto: VerifyOtpDto): Promise<LoginResponse> {
    // 1. Initial OTP Check
    const normPhone = normalizePhoneNumber(verifyOtpDto.phoneNumber);
    if (!normPhone) {
      throw new UnauthorizedException('Invalid phone number');
    }
    await this.usersService.verifyOtp(normPhone, verifyOtpDto.otp);

    // 2. Find or Create User (by userId if provided, else by phoneNumber)
    let userDoc: UserDocument;
    const requestUserId = verifyOtpDto.userId;
    if (requestUserId) {
      const found = await this.usersService.findOne(requestUserId);
      userDoc = found as unknown as UserDocument;
    } else {
      const normPhone = normalizePhoneNumber(verifyOtpDto.phoneNumber);
      const normEmail = normalizeEmail(verifyOtpDto.email);
      let byPhone = await this.usersService.findOneByPhoneNumber(normPhone);
      if (!byPhone && verifyOtpDto.email) {
        const { data: byEmail, userPresent } =
          await this.usersService.findUserByIdentifiers({
            email: normEmail || verifyOtpDto.email,
          });
        if (userPresent && byEmail) byPhone = byEmail;
      }
      if (!byPhone) {
        byPhone = await this.usersService.create({
          phoneNumber: normPhone || verifyOtpDto.phoneNumber,
          role: UserRole.USER,
          ...(verifyOtpDto.name && { name: verifyOtpDto.name }),
          ...(verifyOtpDto.email && { email: normEmail || verifyOtpDto.email }),
          ...(verifyOtpDto.dob && { dob: verifyOtpDto.dob }),
        });
      }
      userDoc = byPhone as UserDocument;
    }

    const userId = String(userDoc._id);

    // 3. Update user: lastLoginAt on every OTP login, plus name/email/dob if provided
    const profileUpdate: {
      name?: string;
      email?: string;
      dob?: string;
      lastLoginAt: string;
    } = { lastLoginAt: new Date().toISOString() };
    if (verifyOtpDto.name !== undefined) profileUpdate.name = verifyOtpDto.name;

    let emailUpdateSkipped = false;
    if (verifyOtpDto.email !== undefined && verifyOtpDto.email !== null) {
      const emailToCheck = normalizeEmail(verifyOtpDto.email);
      if (emailToCheck) {
        const emailTakenByAnotherUser: boolean =
          await this.usersService.isEmailTakenByAnotherUser(
            emailToCheck,
            userId,
          );
        if (!emailTakenByAnotherUser) {
          profileUpdate.email = emailToCheck;
        } else {
          emailUpdateSkipped = true;
        }
      }
    }

    if (verifyOtpDto.dob !== undefined) profileUpdate.dob = verifyOtpDto.dob;

    try {
      const updated = await this.usersService.update(userId, profileUpdate);
      userDoc = updated as unknown as UserDocument;
    } catch (error) {
      const err = error as { code?: number; message?: string };
      if (err?.code === 11000) {
        throw new UnauthorizedException(
          'This email is already linked to another account.',
        );
      }
      throw new UnauthorizedException(
        err?.message ?? 'Failed to complete OTP sign-in',
      );
    }

    // 4. Clear OTP from DB after successful verification
    await this.usersService.clearOtp(userId);

    // 5. Sanitize and Login (ensure otp/password never in response)
    const raw =
      typeof (userDoc as { toObject?: () => unknown }).toObject === 'function'
        ? (userDoc as { toObject: () => unknown }).toObject()
        : { ...userDoc };
    const sanitizedUser = raw as Record<string, unknown>;
    delete sanitizedUser.password;
    delete sanitizedUser.otp;

    const loginResponse = this.login(sanitizedUser as unknown as ValidatedUser);

    return {
      ...loginResponse,
      ...(emailUpdateSkipped ? { emailUpdateSkipped: true } : {}),
    };
  }

  async getProfile(userId: string): Promise<ValidatedUser> {
    const userDoc = await this.usersService.findOne(userId);
    const sanitizedUser = { ...userDoc } as Record<string, unknown>;
    delete sanitizedUser.password;
    return sanitizedUser as unknown as ValidatedUser;
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
      user = await this.usersService.findOneByName(name, true);
    } else if (email) {
      user = await this.usersService.findOneByEmail(email, true);
    }

    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      const result = user.toObject();
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
      expiresIn: '1d',
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
