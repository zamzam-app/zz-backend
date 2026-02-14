import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  Get,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import type { Response, Request as ExpressRequest } from 'express';
import {
  AuthTokens,
  LoginResponse,
  JwtPayload,
  ValidatedUser,
} from './interfaces/auth.interfaces';
import { CookieInterceptor } from './interceptors/cookie.interceptor';

@ApiTags('auth')
@Controller('auth')
@UseInterceptors(CookieInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Admin/Manager Login (Username/Email + Password)' })
  @ApiBody({ type: LoginDto })
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<Omit<LoginResponse, 'refresh_token'>> {
    return this.authService.signIn(loginDto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'User Login (Phone + OTP)' })
  @ApiBody({ type: VerifyOtpDto })
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
  ): Promise<Omit<LoginResponse, 'refresh_token'>> {
    return this.authService.signInWithOtp(verifyOtpDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  refresh(@Request() req: ExpressRequest): Omit<AuthTokens, 'refresh_token'> {
    const refreshToken = req.cookies['refresh_token'] as string;
    const result = this.authService.refresh(refreshToken);
    return { access_token: result.access_token };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and clear refresh token cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile (protected)' })
  async getProfile(
    @Request() req: ExpressRequest & { user: JwtPayload },
  ): Promise<ValidatedUser> {
    return this.authService.getProfile(req.user.sub);
  }
}
