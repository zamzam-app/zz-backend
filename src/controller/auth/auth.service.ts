import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
import {
  normalizeEmail,
  normalizePhoneNumber,
} from '../../util/normalize.util';
import { Msg91Service } from '../../integrations/msg91/msg91.service';
import {
  JwtPayload,
  AuthTokens,
  LoginResponse,
  ValidatedUser,
} from './interfaces/auth.interfaces';

/** Per-phone caps, on top of the per-IP route throttles (an attacker can rotate IPs). */
const PHONE_WINDOW_MS = 10 * 60 * 1000;
const MAX_OTP_REQUESTS_PER_PHONE = 3;
const MAX_OTP_VERIFY_ATTEMPTS_PER_PHONE = 10;

@Injectable()
export class AuthService {
  // In-memory, so per instance. Fine for a single API instance.
  private readonly otpRequestLog = new Map<string, number[]>();
  private readonly otpVerifyLog = new Map<string, number[]>();

  /** Records an attempt for `key`; throws 429 once `max` is hit within the window. */
  private enforcePhoneLimit(
    log: Map<string, number[]>,
    key: string,
    max: number,
  ): void {
    const now = Date.now();
    const recent = (log.get(key) ?? []).filter(
      (t) => now - t < PHONE_WINDOW_MS,
    );
    if (recent.length >= max) {
      log.set(key, recent);
      throw new HttpException(
        'Too many attempts for this phone number. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    log.set(key, recent);
    // Keep the maps from growing without bound.
    if (log.size > 10_000) {
      for (const [k, times] of log) {
        if (times.every((t) => now - t >= PHONE_WINDOW_MS)) log.delete(k);
      }
    }
  }

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private msg91Service: Msg91Service,
  ) {}

  // Admin and Manager login
  async signIn(loginDto: LoginDto): Promise<LoginResponse> {
    const user = await this.validateUser({
      pass: loginDto.password,
      userName: loginDto.userName,
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

  /** Request OTP: find user by phone or create new user, then send OTP via Twilio Verify. */
  async requestOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const normPhone = normalizePhoneNumber(dto.phoneNumber);
    if (!normPhone) {
      throw new BadRequestException('Invalid phone number');
    }
    this.enforcePhoneLimit(
      this.otpRequestLog,
      normPhone,
      MAX_OTP_REQUESTS_PER_PHONE,
    );
    let userDoc: UserDocument | null =
      (await this.usersService.findOneByPhoneNumber(
        normPhone,
      )) as UserDocument | null;

    if (userDoc) {
      await this.msg91Service.sendOtp(normPhone);
      return { message: 'OTP sent successfully to your phone number' };
    }

    userDoc = await this.usersService.create({
      phoneNumber: normPhone,
      role: UserRole.USER,
    });
    await this.msg91Service.sendOtp(normPhone);
    return { message: 'OTP sent successfully to your phone number' };
  }

  // Users OTP login (Auto-registration supported)
  async signInWithOtp(verifyOtpDto: VerifyOtpDto): Promise<LoginResponse> {
    const normPhone = normalizePhoneNumber(verifyOtpDto.phoneNumber);
    if (!normPhone) {
      throw new UnauthorizedException('Invalid OTP');
    }
    this.enforcePhoneLimit(
      this.otpVerifyLog,
      normPhone,
      MAX_OTP_VERIFY_ATTEMPTS_PER_PHONE,
    );
    await this.msg91Service.verifyOtp(normPhone, verifyOtpDto.otp);

    // 2. Find or Create User by the verified phone number only. The account
    // must never be chosen by anything else in the request body.
    const normEmail = normalizeEmail(verifyOtpDto.email);
    let byPhone = await this.usersService.findOneByPhoneNumber(normPhone);
    if (!byPhone) {
      byPhone = await this.usersService.create({
        phoneNumber: normPhone,
        role: UserRole.USER,
        ...(verifyOtpDto.name && { name: verifyOtpDto.name }),
        ...(verifyOtpDto.email && { email: normEmail || verifyOtpDto.email }),
        ...(verifyOtpDto.dob && { dob: verifyOtpDto.dob }),
      });
    }
    if (!this.isAccountUsable(byPhone as UserDocument)) {
      throw new UnauthorizedException('This account is not active');
    }
    let userDoc = byPhone as UserDocument;

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

    // 4. Sanitize and Login (ensure otp/password never in response)
    const raw =
      typeof (userDoc as { toObject?: () => unknown }).toObject === 'function'
        ? (userDoc as { toObject: () => unknown }).toObject()
        : { ...userDoc };
    const sanitizedUser = raw as Record<string, unknown>;
    delete sanitizedUser.password;
    delete sanitizedUser.otp;

    const loginResponse = this.login({
      ...sanitizedUser,
      tokenSyncRequired: false,
    } as unknown as ValidatedUser);

    return {
      ...loginResponse,
      ...(emailUpdateSkipped ? { emailUpdateSkipped: true } : {}),
    };
  }

  async getProfile(userId: string, deviceId?: string): Promise<ValidatedUser> {
    const userDoc = await this.usersService.findOne(userId);

    let tokenSyncRequired = false;
    if (deviceId) {
      const hasToken = await this.usersService.hasPushTokenForDevice(
        userId,
        deviceId,
      );
      tokenSyncRequired = !hasToken;
    }

    return { ...(userDoc as unknown as ValidatedUser), tokenSyncRequired };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }
    return this.refreshTokens(refreshToken);
  }

  /** Deleted or deactivated accounts must not be able to sign in or refresh. */
  private isAccountUsable(user?: { isDeleted?: boolean; isActive?: boolean }) {
    return !!user && user.isDeleted !== true && user.isActive !== false;
  }

  async validateUser(
    validateUserDto: ValidateUserDto,
  ): Promise<ValidatedUser | null> {
    const { pass, userName, email, name } = validateUserDto;
    let user: UserDocument | null = null;
    if (userName?.trim()) {
      const { data, userPresent } =
        await this.usersService.findUserByIdentifiers({
          userName,
          includePassword: true,
        });
      if (userPresent && data) {
        user = data as UserDocument;
      }
    } else if (email) {
      user = await this.usersService.findOneByEmail(email, true);
    } else if (name) {
      user = await this.usersService.findOneByName(name, true);
    }

    if (
      user &&
      this.isAccountUsable(user) &&
      user.password &&
      (await bcrypt.compare(pass, user.password))
    ) {
      // Never hand the password hash (or other secrets) back to callers: the
      // result ends up in the login response.
      const result = { ...user.toObject() } as Record<string, unknown>;
      delete result.password;
      delete result.otp;
      delete result.pushTokens;
      return { ...result, tokenSyncRequired: false } as ValidatedUser;
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

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Re-read the user so a removed, deactivated or demoted account cannot keep
    // refreshing, and the new token carries the current role.
    const current = await this.usersService.getAuthState(payload.sub);
    if (!current || !this.isAccountUsable(current)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.generateTokens({
      name: current.name ?? payload.name,
      sub: payload.sub,
      role: current.role,
    });
  }
}
