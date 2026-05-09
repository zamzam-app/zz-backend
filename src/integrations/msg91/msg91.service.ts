import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);
  private readonly authKey: string;
  private readonly templateId: string;
  private readonly baseUrl = 'https://control.msg91.com/api/v5';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const authKey = this.configService.get<string>('MSG91_AUTH_KEY');
    const templateId = this.configService.get<string>('MSG91_TEMPLATE_ID');

    if (!authKey || !templateId) {
      this.logger.warn(
        'MSG91_AUTH_KEY or MSG91_TEMPLATE_ID is missing from environment variables. OTP will not work.',
      );
    }

    this.authKey = authKey || '';
    this.templateId = templateId || '';
  }

  async sendOtp(phoneNumber: string): Promise<void> {
    if (!this.authKey || !this.templateId) {
      throw new InternalServerErrorException(
        'MSG91 is not configured properly',
      );
    }

    try {
      // MSG91 expects the mobile number with the country code (e.g., 91XXXXXXXXXX)
      // Strip any non-numeric characters from the phone number
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/otp`,
          {},
          {
            params: {
              template_id: this.templateId,
              mobile: cleanPhoneNumber,
            },
            headers: {
              authkey: this.authKey,
            },
          },
        ),
      );

      const data = response.data as { type?: string };
      if (data.type === 'error') {
        this.logger.error(
          `Failed to send OTP: ${JSON.stringify(response.data)}`,
        );
        throw new InternalServerErrorException('Failed to send OTP');
      }
    } catch (error) {
      this.logger.error(`Error sending OTP to ${phoneNumber}`, error);
      throw new InternalServerErrorException(
        'Failed to send OTP to the phone number',
      );
    }
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<void> {
    if (!this.authKey) {
      throw new InternalServerErrorException(
        'MSG91 is not configured properly',
      );
    }

    try {
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/otp/verify`, {
          params: {
            otp,
            mobile: cleanPhoneNumber,
          },
          headers: {
            authkey: this.authKey,
          },
        }),
      );

      const data = response.data as { type?: string };
      if (data.type === 'error') {
        this.logger.warn(
          `Failed OTP verification: ${JSON.stringify(response.data)}`,
        );
        throw new UnauthorizedException('Invalid OTP');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Error verifying OTP for ${phoneNumber}`, error);
      throw new UnauthorizedException('Invalid OTP or verification failed');
    }
  }
}
