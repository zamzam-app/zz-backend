import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryApi } from './interfaces/cloudinary-api.interface';

const cloudinaryApi = cloudinary as CloudinaryApi;

@Injectable()
export class UploadService {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary configuration is not set');
    }
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    cloudinaryApi.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
    });
  }

  /**
   * Returns signed upload params for the client. Client will send these
   * + the file to Cloudinary.
   */
  getSignedUploadParams(options?: { folder?: string }) {
    const folder = options?.folder ?? 'zam-zam';
    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign: Record<string, unknown> = {
      timestamp,
      folder,
    };
    const signature = cloudinaryApi.utils.api_sign_request(
      paramsToSign,
      this.apiSecret,
    );
    return {
      signature,
      timestamp,
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      folder,
    };
  }
}
