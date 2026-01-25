import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(name: string | undefined, pass: string, email?: string) {
    let user: UserDocument | null = null;
    if (name) {
      user = (await this.usersService.findOneByName(name)) as UserDocument;
    } else if (email) {
      user = (await this.usersService.findOneByEmail(email)) as UserDocument;
    }

    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      const result = user.toObject();
      delete (result as any).password;
      return result;
    }
    return null;
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<any> {
    if (otp !== '123456') {
      // TODO: Remove this after OTP integration
      throw new UnauthorizedException('Invalid OTP');
    }

    const user = (await this.usersService.findOneByPhoneNumber(
      phoneNumber,
    )) as UserDocument;
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const result = user.toObject();
    delete (result as any).password;
    return result;
  }

  async login(user: any) {
    const payload = {
      name: user.name,
      sub: user._id,
      role: user.role,
    };
    return this.generateTokens(payload);
  }

  async generateTokens(payload: any) {
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

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const newPayload = {
        username: payload.username,
        sub: payload.sub,
        role: payload.role,
      };

      return this.generateTokens(newPayload);
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
