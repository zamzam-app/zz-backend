import { Controller, Get, Query } from '@nestjs/common';
import { ApiUploadController, ApiUploadSignature } from './dto/upload.swagger';
import { UploadService } from './upload.service';

@ApiUploadController()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('signature')
  @ApiUploadSignature()
  getSignature(@Query('folder') folder?: string) {
    return this.uploadService.getSignedUploadParams(
      folder ? { folder } : undefined,
    );
  }
}
