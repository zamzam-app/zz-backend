import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { QuestionType } from '../entities/question.entity';

export class QuestionDtoSwagger {
  @ApiProperty({ example: true, description: 'Whether the question is active' })
  isActive: boolean;

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
    example: true,
    description: 'Whether the question is required',
  })
  isRequired: boolean;

  @ApiProperty({ example: 'Please enter your full name', required: false })
  hint?: string;

  @ApiProperty({ type: [Object], required: false })
  options?: object[];

  @ApiProperty({ example: 5, required: false })
  maxRatings?: number;
}

export function ApiQuestionCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new question' }),
    ApiCreatedResponse({
      description: 'Question created successfully.',
      type: QuestionDtoSwagger,
    }),
  );
}

export function ApiQuestionFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all active questions (Admin only)' }),
    ApiOkResponse({
      description: 'Return all active questions.',
      type: [QuestionDtoSwagger],
    }),
  );
}

export function ApiQuestionFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a question by ID' }),
    ApiOkResponse({
      description: 'Return the question.',
      type: QuestionDtoSwagger,
    }),
    ApiNotFoundResponse({ description: 'Question not found.' }),
  );
}

export function ApiQuestionUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a question' }),
    ApiOkResponse({
      description: 'Question updated successfully.',
      type: QuestionDtoSwagger,
    }),
    ApiNotFoundResponse({ description: 'Question not found.' }),
  );
}

export function ApiQuestionRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Soft delete a question' }),
    ApiOkResponse({
      description: 'Question deleted successfully.',
    }),
    ApiNotFoundResponse({ description: 'Question not found.' }),
  );
}
