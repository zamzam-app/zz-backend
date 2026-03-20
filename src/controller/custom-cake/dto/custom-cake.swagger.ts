import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { CustomCake } from '../entities/custom-cake.entity';

export function ApiCustomCakeCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Save a custom cake' }),
    ApiCreatedResponse({
      description: 'Custom cake saved successfully.',
      type: CustomCake,
    }),
  );
}

export function ApiCustomCakeFindAll() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get all custom cakes',
      description:
        'Returns paginated list. Optional query: page, limit, userId to filter by user.',
    }),
    ApiOkResponse({
      description: 'List of custom cakes with meta (total, currentPage, etc.).',
    }),
  );
}

export function ApiCustomCakeFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Get one custom cake by ID' }),
    ApiOkResponse({
      description: 'Custom cake found.',
      type: CustomCake,
    }),
    ApiNotFoundResponse({ description: 'Custom cake not found.' }),
  );
}
