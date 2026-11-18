import { Throttle } from '@nestjs/throttler';
import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { ApiUploadController, ApiUploadSignature } from './dto/upload.swagger';
import {
  UploadKind,
  UploadSignatureQueryDto,
} from './dto/upload-signature-query.dto';
import { UploadService } from './upload.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/interfaces/user.interface';

/** Folders the unauthenticated customer site may upload images to. */
const PUBLIC_UPLOAD_FOLDERS = ['custom-cake', 'custom-cakes'];

@ApiUploadController()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /** Staff uploads (admin dashboard, manager app): any folder and kind. */
  @Get('signature')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiUploadSignature()
  getSignature(@Query() query: UploadSignatureQueryDto) {
    return this.uploadService.getSignedUploadParams(query);
  }

  /** Customer site uploads (custom cake): images into allow-listed folders only. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('public-signature')
  @ApiUploadSignature()
  getPublicSignature(@Query() query: UploadSignatureQueryDto) {
    if (!query.folder || !PUBLIC_UPLOAD_FOLDERS.includes(query.folder)) {
      throw new ForbiddenException('Upload folder not allowed');
    }
    return this.uploadService.getSignedUploadParams({
      folder: query.folder,
      kind: UploadKind.IMAGE,
    });
  }
}
