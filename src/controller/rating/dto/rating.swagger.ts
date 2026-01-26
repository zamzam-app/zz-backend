import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiProperty,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Rating, RatingType } from '../entities/rating.entity';

export class ResponseDtoSwagger {
  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'MongoDB ObjectId of the question',
  })
  questionId: string;

  @ApiProperty({
    example: 'User answer to the question',
    description: 'Answer to the question (can be string, array, or number)',
  })
  answer: string | string[] | number;
}

export class CreateRatingDtoSwagger {
  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'MongoDB ObjectId of the form',
  })
  formId: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'MongoDB ObjectId of the user',
  })
  userId: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'MongoDB ObjectId of the outlet',
  })
  outletId: string;

  @ApiProperty({
    example: [
      {
        questionId: '60d5ecb86217152c9043e02d',
        answer: 4,
      },
      {
        questionId: '60d5ecb86217152c9043e02e',
        answer: 'Great service',
      },
    ],
    description: 'Array of responses with questionId and answer',
    type: [ResponseDtoSwagger],
  })
  response: ResponseDtoSwagger[];

  @ApiProperty({
    example: 'review',
    enum: RatingType,
    description: 'Type of rating (complaint or review)',
    required: false,
  })
  type?: RatingType;
}

export class UpdateRatingDtoSwagger {
  @ApiProperty({
    example: [
      {
        questionId: '60d5ecb86217152c9043e02d',
        answer: 5,
      },
    ],
    description: 'Array of responses with questionId and answer',
    type: [ResponseDtoSwagger],
    required: false,
  })
  response?: ResponseDtoSwagger[];

  @ApiProperty({
    example: 'complaint',
    enum: RatingType,
    description: 'Type of rating',
    required: false,
  })
  type?: RatingType;
}

export function ApiRatingCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new rating' }),
    ApiCreatedResponse({
      description: 'Rating created successfully.',
      type: Rating,
    }),
    ApiBadRequestResponse({ description: 'Invalid form ID or rating data.' }),
    ApiNotFoundResponse({ description: 'Form not found.' }),
  );
}

export function ApiRatingFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all active ratings' }),
    ApiOkResponse({
      description: 'Return all active ratings.',
      type: [Rating],
    }),
  );
}

export function ApiRatingFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a specific rating by ID' }),
    ApiOkResponse({
      description: 'Return the rating details.',
      type: Rating,
    }),
    ApiBadRequestResponse({ description: 'Invalid rating ID format.' }),
    ApiNotFoundResponse({ description: 'Rating not found.' }),
  );
}

export function ApiRatingUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an existing rating' }),
    ApiOkResponse({
      description: 'Rating updated successfully.',
      type: Rating,
    }),
    ApiBadRequestResponse({ description: 'Invalid rating ID format.' }),
    ApiNotFoundResponse({ description: 'Rating not found.' }),
  );
}

export function ApiRatingRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Soft delete a rating' }),
    ApiOkResponse({
      description: 'Rating deleted successfully.',
      type: Rating,
    }),
    ApiBadRequestResponse({ description: 'Invalid rating ID format.' }),
    ApiNotFoundResponse({ description: 'Rating not found.' }),
  );
}
