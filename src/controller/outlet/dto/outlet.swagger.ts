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
    ApiOperation({ summary: 'Retrieve all outlets' }),
    ApiOkResponse({
      description: 'Successfully retrieved all outlets.',
      type: [Outlet],
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
