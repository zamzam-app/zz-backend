import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  getSchemaPath,
} from '@nestjs/swagger';
import { TaskCategory } from '../entities/task-category.entity';

export function ApiTaskCategoryCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new task category' }),
    ApiCreatedResponse({
      description: 'The task category has been successfully created.',
      type: TaskCategory,
    }),
  );
}

export function ApiTaskCategoryFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve all task categories (paginated)' }),
    ApiExtraModels(TaskCategory),
    ApiOkResponse({
      description: 'Successfully retrieved task categories with pagination.',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(TaskCategory) },
          },
          meta: {
            type: 'object',
            properties: {
              total: { type: 'number', example: 42 },
              currentPage: { type: 'number', example: 1 },
              hasPrevPage: { type: 'boolean', example: false },
              hasNextPage: { type: 'boolean', example: true },
              limit: { type: 'number', example: 10 },
            },
          },
        },
      },
    }),
  );
}

export function ApiTaskCategoryFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve a task category by ID' }),
    ApiOkResponse({
      description: 'Successfully retrieved the task category.',
      type: TaskCategory,
    }),
    ApiNotFoundResponse({ description: 'Task category not found.' }),
  );
}

export function ApiTaskCategoryUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a task category by ID' }),
    ApiOkResponse({
      description: 'The task category has been successfully updated.',
      type: TaskCategory,
    }),
    ApiNotFoundResponse({ description: 'Task category not found.' }),
  );
}

export function ApiTaskCategoryRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a task category by ID (Soft delete)' }),
    ApiOkResponse({
      description: 'The task category has been successfully deleted.',
      type: TaskCategory,
    }),
    ApiNotFoundResponse({ description: 'Task category not found.' }),
  );
}
