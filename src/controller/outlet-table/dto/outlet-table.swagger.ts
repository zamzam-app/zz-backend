import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { OutletTable } from '../entities/outlet-table.entity';

export function ApiOutletTableCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new outlet table' }),
    ApiCreatedResponse({
      description: 'The outlet table has been successfully created.',
      type: OutletTable,
    }),
  );
}

export function ApiOutletTableFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve all outlet tables with pagination' }),
    ApiOkResponse({
      description: 'Successfully retrieved outlet tables.',
      schema: {
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/OutletTable' },
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

export function ApiOutletTableFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve an outlet table by ID' }),
    ApiOkResponse({
      description: 'Successfully retrieved the outlet table.',
      type: OutletTable,
    }),
    ApiNotFoundResponse({ description: 'Outlet table not found.' }),
  );
}

export function ApiOutletTableUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an outlet table by ID' }),
    ApiOkResponse({
      description: 'The outlet table has been successfully updated.',
      type: OutletTable,
    }),
    ApiNotFoundResponse({ description: 'Outlet table not found.' }),
  );
}

export function ApiOutletTableRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete an outlet table by ID (Soft delete)' }),
    ApiOkResponse({
      description: 'The outlet table has been successfully deleted.',
      type: OutletTable,
    }),
    ApiNotFoundResponse({ description: 'Outlet table not found.' }),
  );
}
