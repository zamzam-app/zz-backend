import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { User } from '../entities/user.entity';

export function ApiUserCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new user' }),
    ApiCreatedResponse({
      description: 'The user has been successfully created.',
      type: User,
    }),
  );
}

export function ApiUserFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve all users (Admin/Manager only)' }),
    ApiExtraModels(User),
    ApiOkResponse({
      description: 'Successfully retrieved users.',
      schema: {
        type: 'array',
        items: { $ref: getSchemaPath(User) },
      },
    }),
  );
}

export function ApiUserFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve a user by ID' }),
    ApiOkResponse({
      description: 'Successfully retrieved the user.',
      type: User,
    }),
    ApiNotFoundResponse({ description: 'User not found.' }),
  );
}

export function ApiUserUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a user by ID' }),
    ApiOkResponse({
      description: 'The user has been successfully updated.',
      type: User,
    }),
    ApiNotFoundResponse({ description: 'User not found.' }),
  );
}

export function ApiUserChangePassword() {
  return applyDecorators(
    ApiOperation({ summary: 'Change user password' }),
    ApiOkResponse({
      description: 'Password has been successfully changed.',
      type: User,
    }),
    ApiNotFoundResponse({ description: 'User not found.' }),
  );
}

export function ApiUserRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a user by ID (Admin only)' }),
    ApiOkResponse({
      description: 'The user has been successfully deleted.',
      type: User,
    }),
    ApiNotFoundResponse({ description: 'User not found.' }),
  );
}
