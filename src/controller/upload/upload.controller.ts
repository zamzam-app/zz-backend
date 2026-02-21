import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiUploadController, ApiUploadSignature } from './dto/upload.swagger';
import { UploadService } from './upload.service';

@ApiUploadController()
@Controller('upload')
@UseGuards(JwtAuthGuard)
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
