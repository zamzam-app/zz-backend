import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { Form, QuestionType } from '../entities/form.entity';

export class QuestionDtoSwagger {
  @ApiProperty({
    example: 'short_answer',
    description: 'Type of the question',
    enum: QuestionType,
  })
  type: QuestionType;

  @ApiProperty({
    example: 'What is your name?',
    description: 'Title of the question',
  })
  title: string;

  @ApiProperty({
    example: 'Please enter your full name',
    description: 'Hint for the question',
    required: false,
  })
  hint?: string;

  @ApiProperty({
    example: [{ text: 'Option 1' }, { text: 'Option 2' }],
    description: 'Array of options for multiple choice or checkbox questions',
    type: [Object],
    required: false,
  })
  options?: object[];

  @ApiProperty({
    example: true,
    description: 'Whether the question is required',
  })
  isRequired: boolean;

  @ApiProperty({
    example: 5,
    description: 'Maximum rating for star rating questions',
    required: false,
  })
  maxRatings?: number;
}

export class CreateFormDtoSwagger {
  @ApiProperty({
    example: 'Customer Feedback Form',
    description: 'Title of the form',
  })
  title: string;

  @ApiProperty({ example: 1, description: 'Version number of the form' })
  version?: number;

  @ApiProperty({
    example: [
      {
        type: QuestionType.ShortAnswer,
        title: 'What is your name?',
        hint: 'Please enter your full name',
        isRequired: true,
      },
      {
        type: QuestionType.Paragraph,
        title: 'Tell us about yourself',
        isRequired: false,
      },
    ],
    description: 'Array of form questions',
    type: [QuestionDtoSwagger],
  })
  questions: QuestionDtoSwagger[];

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated user ID',
    required: false,
  })
  userId?: string;
}

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
