import { Controller, Get, Query } from '@nestjs/common';
import { ApiUploadController, ApiUploadSignature } from './dto/upload.swagger';
import { UploadSignatureQueryDto } from './dto/upload-signature-query.dto';
import { UploadService } from './upload.service';

@ApiUploadController()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('signature')
  @ApiUploadSignature()
  getSignature(@Query() query: UploadSignatureQueryDto) {
    return this.uploadService.getSignedUploadParams(query);
  }
}
