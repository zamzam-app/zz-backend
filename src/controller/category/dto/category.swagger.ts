import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Category } from '../entities/category.entity';

export function ApiCategoryCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new category' }),
    ApiCreatedResponse({
      description: 'The category has been successfully created.',
      type: Category,
    }),
  );
}

export function ApiCategoryFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve all categories (paginated)' }),
    ApiExtraModels(Category),
    ApiOkResponse({
      description: 'Successfully retrieved categories with pagination meta.',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(Category) },
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

export function ApiCategoryFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve a category by ID' }),
    ApiOkResponse({
      description: 'Successfully retrieved the category.',
      type: Category,
    }),
    ApiNotFoundResponse({ description: 'Category not found.' }),
  );
}

export function ApiCategoryUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a category by ID' }),
    ApiOkResponse({
      description: 'The category has been successfully updated.',
      type: Category,
    }),
    ApiNotFoundResponse({ description: 'Category not found.' }),
  );
}

export function ApiCategoryRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a category by ID (Soft delete)' }),
    ApiOkResponse({
      description: 'The category has been successfully deleted.',
      type: Category,
    }),
    ApiNotFoundResponse({ description: 'Category not found.' }),
  );
}
