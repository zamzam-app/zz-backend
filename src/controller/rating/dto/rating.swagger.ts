import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiBadRequestResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Rating, ComplaintStatus } from '../entities/rating.entity';

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

export class ResolveComplaintDtoSwagger {
  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'MongoDB ObjectId of the question (userResponse) to resolve',
  })
  questionId: string;

  @ApiProperty({
    example: 'resolved',
    enum: ComplaintStatus,
    description: 'New complaint status (resolved or dismissed)',
  })
  complaintStatus: ComplaintStatus;

  @ApiPropertyOptional({
    example: 'Updated answer after review',
    description: 'Optional updated answer for the question',
  })
  answer?: string;

  @ApiPropertyOptional({
    example: 'Issue addressed with the customer.',
    description: 'Notes describing the resolution or dismissal',
  })
  resolutionNotes?: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'MongoDB ObjectId of the user resolving the complaint',
  })
  resolvedBy: string;
}

export function ApiRatingResolveComplaint() {
  return applyDecorators(
    ApiOperation({
      summary: 'Resolve or reject a complaint',
      description:
        'Updates the complaint status, resolution notes, resolvedBy, and sets resolvedAt to current date/time for the given question (userResponse) in the rating.',
    }),
    ApiBody({ type: ResolveComplaintDtoSwagger }),
    ApiOkResponse({
      description: 'Rating updated with resolved complaint.',
      type: Rating,
    }),
    ApiBadRequestResponse({
      description: 'Invalid rating ID, question ID, or body.',
    }),
    ApiNotFoundResponse({
      description: 'Rating not found or question not found in rating.',
    }),
  );
}
