import { applyDecorators } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { UploadedCake } from '../entities/uploaded-cake.entity';

export function ApiUploadedCakeCreate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create uploaded cake request',
      description:
        'Creates an uploaded-cake request using a pre-uploaded image URL from the client.',
    }),
    ApiCreatedResponse({
      description: 'Uploaded cake request created successfully.',
      type: UploadedCake,
    }),
  );
}
