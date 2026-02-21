import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SignatureResponseDto } from './signature-response.dto';

export function ApiUploadController() {
  return applyDecorators(ApiTags('upload'), ApiBearerAuth('JWT-auth'));
}

export function ApiUploadSignature() {
  return applyDecorators(
    ApiOperation({ summary: 'Get Cloudinary signed upload params' }),
    ApiQuery({
      name: 'folder',
      required: false,
      description: 'Cloudinary folder (e.g. products, outlets, avatars)',
    }),
    ApiOkResponse({
      description:
        'Signed upload params for the client to upload to Cloudinary.',
      type: SignatureResponseDto,
    }),
  );
}
