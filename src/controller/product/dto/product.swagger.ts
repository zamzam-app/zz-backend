import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Product } from '../entities/product.entity';

export function ApiProductCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new product' }),
    ApiCreatedResponse({
      description: 'The product has been successfully created.',
      type: Product,
    }),
  );
}

export function ApiProductFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve all products (paginated)' }),
    ApiExtraModels(Product),
    ApiOkResponse({
      description: 'Successfully retrieved products with pagination meta.',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(Product) },
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

export function ApiProductFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Retrieve a product by ID' }),
    ApiOkResponse({
      description: 'Successfully retrieved the product.',
      type: Product,
    }),
    ApiNotFoundResponse({ description: 'Product not found.' }),
  );
}

export function ApiProductUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a product by ID' }),
    ApiOkResponse({
      description: 'The product has been successfully updated.',
      type: Product,
    }),
    ApiNotFoundResponse({ description: 'Product not found.' }),
  );
}

export function ApiProductRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a product by ID (Soft delete)' }),
    ApiOkResponse({
      description: 'The product has been successfully deleted.',
      type: Product,
    }),
    ApiNotFoundResponse({ description: 'Product not found.' }),
  );
}
