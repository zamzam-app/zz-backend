import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
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

export function ApiUploadedCakeFindAll() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get all uploaded cakes',
      description:
        'Returns paginated list. Optional query: page, limit, userId to filter by user.',
    }),
    ApiOkResponse({
      description:
        'List of uploaded cakes with meta (total, currentPage, etc.).',
    }),
  );
}

export function ApiUploadedCakeFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Get one uploaded cake by ID' }),
    ApiOkResponse({
      description: 'Uploaded cake found.',
      type: UploadedCake,
    }),
    ApiNotFoundResponse({ description: 'Uploaded cake not found.' }),
  );
}
