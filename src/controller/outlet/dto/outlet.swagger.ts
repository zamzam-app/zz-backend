import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Outlet } from '../entities/outlet.entity';

export function ApiOutletCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new outlet' }),
    ApiCreatedResponse({
      description: 'The outlet has been successfully created.',
      type: Outlet,
    }),
  );
}

export function ApiOutletFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve all outlets with pagination' }),
    ApiOkResponse({
      description: 'Successfully retrieved outlets.',
      schema: {
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Outlet' },
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

export function ApiOutletFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve an outlet by ID' }),
    ApiOkResponse({
      description: 'Successfully retrieved the outlet.',
      type: Outlet,
    }),
    ApiNotFoundResponse({ description: 'Outlet not found.' }),
  );
}

export function ApiOutletFindByQrToken() {
  return applyDecorators(
    ApiOperation({ summary: 'Get outlet and form by QR token' }),
    ApiOkResponse({
      description: 'Successfully retrieved outlet with populated form.',
      schema: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'Outlet ID' },
          name: { type: 'string', description: 'Outlet name' },
          form: {
            nullable: true,
            description:
              'Populated form document with questions, or null if outlet has no form',
          },
        },
      },
    }),
    ApiNotFoundResponse({ description: 'Outlet not found.' }),
  );
}

export function ApiOutletUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an outlet by ID' }),
    ApiOkResponse({
      description: 'The outlet has been successfully updated.',
      type: Outlet,
    }),
    ApiNotFoundResponse({ description: 'Outlet not found.' }),
  );
}

export function ApiOutletRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete an outlet by ID (Soft delete)' }),
    ApiOkResponse({
      description: 'The outlet has been successfully deleted.',
      type: Outlet,
    }),
    ApiNotFoundResponse({ description: 'Outlet not found.' }),
  );
}
