import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

export function ApiCakeCustomizationOptionCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new cake customization option' }),
    ApiResponse({ status: 201, description: 'Option successfully created.' }),
    ApiBadRequestResponse({ description: 'Invalid input data.' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error.' }),
  );
}

export function ApiCakeCustomizationOptionFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all cake customization options' }),
    ApiResponse({ status: 200, description: 'Returns paginated options.' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error.' }),
  );
}

export function ApiCakeCustomizationOptionFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a specific cake customization option by ID' }),
    ApiResponse({ status: 200, description: 'Returns the option.' }),
    ApiNotFoundResponse({ description: 'Option not found.' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error.' }),
  );
}

export function ApiCakeCustomizationOptionUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a cake customization option' }),
    ApiResponse({ status: 200, description: 'Option successfully updated.' }),
    ApiNotFoundResponse({ description: 'Option not found.' }),
    ApiBadRequestResponse({ description: 'Invalid input data.' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error.' }),
  );
}

export function ApiCakeCustomizationOptionRemove() {
  return applyDecorators(
    ApiOperation({
      summary: 'Remove a cake customization option (soft delete)',
    }),
    ApiResponse({ status: 200, description: 'Option successfully removed.' }),
    ApiNotFoundResponse({ description: 'Option not found.' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error.' }),
  );
}
