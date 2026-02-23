import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { OutletType } from '../entities/outlet-type.entity';

export function ApiOutletTypeCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new outlet type' }),
    ApiCreatedResponse({
      description: 'Outlet type created successfully.',
      type: OutletType,
    }),
  );
}

export function ApiOutletTypeFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all active outlet types with pagination' }),
    ApiOkResponse({
      description: 'Return all active outlet types.',
      schema: {
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/OutletType' },
          },
          meta: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              currentPage: { type: 'number' },
              hasPrevPage: { type: 'boolean' },
              hasNextPage: { type: 'boolean' },
              limit: { type: 'number' },
            },
          },
        },
      },
    }),
  );
}

export function ApiOutletTypeFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a specific outlet type by ID' }),
    ApiOkResponse({
      description: 'Return the outlet type details.',
      type: OutletType,
    }),
    ApiNotFoundResponse({ description: 'Outlet type not found.' }),
  );
}

export function ApiOutletTypeUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an existing outlet type' }),
    ApiOkResponse({
      description: 'Outlet type updated successfully.',
      type: OutletType,
    }),
    ApiNotFoundResponse({ description: 'Outlet type not found.' }),
  );
}

export function ApiOutletTypeRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Soft delete an outlet type' }),
    ApiOkResponse({
      description: 'Outlet type deleted successfully.',
      type: OutletType,
    }),
    ApiNotFoundResponse({ description: 'Outlet type not found.' }),
  );
}
