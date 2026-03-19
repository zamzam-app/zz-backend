import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { CustomCake } from '../entities/custom-cake.entity';

export function ApiCustomCakeCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Save a custom cake (authenticated)' }),
    ApiCreatedResponse({
      description: 'Custom cake saved successfully.',
      type: CustomCake,
    }),
  );
}
