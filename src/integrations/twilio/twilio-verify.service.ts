import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { Twilio } from 'twilio';

@Injectable()
export class TwilioVerifyService {
  private readonly accountSid?: string;
  private readonly authToken?: string;
  private readonly verifyServiceSid?: string;
  private readonly client: Twilio | null;

  constructor(private readonly configService: ConfigService) {
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.verifyServiceSid = this.configService.get<string>(
      'TWILIO_VERIFY_SERVICE_SID',
    );

    this.client =
      this.accountSid && this.authToken
        ? twilio(this.accountSid, this.authToken)
        : null;
  }

  private getClient(): Twilio {
    if (!this.client || !this.verifyServiceSid) {
      throw new InternalServerErrorException(
        'Twilio OTP service is not configured on the server',
      );
    }
    return this.client;
  }

  private getVerifyServiceSid(): string {
    if (!this.verifyServiceSid) {
      throw new InternalServerErrorException(
        'Twilio Verify Service SID is not configured on the server',
      );
    }
    return this.verifyServiceSid;
  }

  async sendOtp(phoneNumber: string): Promise<void> {
    try {
      await this.getClient()
        .verify.v2.services(this.getVerifyServiceSid())
        .verifications.create({
          to: phoneNumber,
          channel: 'sms',
        });
    } catch {
      throw new InternalServerErrorException(
        'Failed to send OTP to the phone number',
      );
    }
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<void> {
    try {
      const result = await this.getClient()
        .verify.v2.services(this.getVerifyServiceSid())
        .verificationChecks.create({
          to: phoneNumber,
          code: otp,
        });

      if (result.status !== 'approved') {
        throw new UnauthorizedException('Invalid OTP');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to verify OTP');
    }
  }
}
