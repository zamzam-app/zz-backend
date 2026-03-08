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
import { Review, ComplaintStatus } from '../entities/review.entity';

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

export class CreateReviewDtoSwagger {
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

export class UpdateReviewDtoSwagger {
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

export function ApiReviewCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new review' }),
    ApiCreatedResponse({
      description: 'Review created successfully.',
      type: Review,
    }),
    ApiBadRequestResponse({ description: 'Invalid form ID or review data.' }),
    ApiNotFoundResponse({ description: 'Form not found.' }),
  );
}

export function ApiReviewFindAll() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all active reviews' }),
    ApiOkResponse({
      description: 'Return all active reviews.',
      type: [Review],
    }),
  );
}

export function ApiReviewFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a specific review by ID' }),
    ApiOkResponse({
      description: 'Return the review details.',
      type: Review,
    }),
    ApiBadRequestResponse({ description: 'Invalid review ID format.' }),
    ApiNotFoundResponse({ description: 'Review not found.' }),
  );
}

export function ApiReviewUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an existing review' }),
    ApiOkResponse({
      description: 'Review updated successfully.',
      type: Review,
    }),
    ApiBadRequestResponse({ description: 'Invalid review ID format.' }),
    ApiNotFoundResponse({ description: 'Review not found.' }),
  );
}

export function ApiReviewRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Soft delete a review' }),
    ApiOkResponse({
      description: 'Review deleted successfully.',
      type: Review,
    }),
    ApiBadRequestResponse({ description: 'Invalid review ID format.' }),
    ApiNotFoundResponse({ description: 'Review not found.' }),
  );
}

export class ResolveComplaintDtoSwagger {
  @ApiProperty({
    example: 'resolved',
    enum: ComplaintStatus,
    description: 'New complaint status (resolved or dismissed)',
  })
  complaintStatus: ComplaintStatus;

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

export function ApiReviewResolveComplaint() {
  return applyDecorators(
    ApiOperation({
      summary: 'Resolve or reject a complaint',
      description:
        'Updates the complaint status, resolution notes, resolvedBy, and sets resolvedAt on the review.',
    }),
    ApiBody({ type: ResolveComplaintDtoSwagger }),
    ApiOkResponse({
      description: 'Review updated with resolved complaint.',
      type: Review,
    }),
    ApiBadRequestResponse({
      description: 'Invalid review ID or body.',
    }),
    ApiNotFoundResponse({
      description: 'Review not found or not a complaint.',
    }),
  );
}
