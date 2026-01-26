import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Form } from '../entities/form.entity';

export function ApiFormCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new form' }),
    ApiCreatedResponse({
      description: 'Form created successfully.',
      type: Form,
    }),
  );
}

export function ApiFormFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all active forms (Admin only)' }),
    ApiOkResponse({
      description: 'Return all active forms.',
      type: [Form],
    }),
  );
}

export function ApiFormFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a specific form by ID' }),
    ApiOkResponse({
      description: 'Return the form details.',
      type: Form,
    }),
    ApiNotFoundResponse({ description: 'Form not found.' }),
  );
}

export function ApiFormUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an existing form' }),
    ApiOkResponse({
      description: 'Form updated successfully.',
      type: Form,
    }),
    ApiNotFoundResponse({ description: 'Form not found.' }),
  );
}

export function ApiFormRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Soft delete a form' }),
    ApiOkResponse({
      description: 'Form deleted successfully.',
      type: Form,
    }),
    ApiNotFoundResponse({ description: 'Form not found.' }),
  );
}
