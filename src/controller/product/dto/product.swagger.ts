import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
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
    ApiOperation({ summary: 'Retrieve all products' }),
    ApiOkResponse({
      description: 'Successfully retrieved all products.',
      type: [Product],
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
