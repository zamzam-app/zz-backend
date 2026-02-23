import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus } from '../entities/rating.entity';

export class ResolveComplaintDto {
  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'MongoDB ObjectId of the question (userResponse) to resolve',
  })
  @IsMongoId()
  @IsNotEmpty()
  questionId: string;

  @ApiProperty({
    example: 'resolved',
    enum: ComplaintStatus,
    description: 'New complaint status (resolved or dismissed)',
  })
  @IsEnum(ComplaintStatus)
  @IsNotEmpty()
  complaintStatus: ComplaintStatus;

  @ApiPropertyOptional({
    example: 'Updated answer after review',
    description: 'Optional updated answer for the question',
  })
  @IsOptional()
  @IsString()
  answer?: string;

  @ApiPropertyOptional({
    example: 'Issue addressed with the customer.',
    description: 'Notes describing the resolution or dismissal',
  })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'MongoDB ObjectId of the user resolving the complaint',
  })
  @IsMongoId()
  @IsNotEmpty()
  resolvedBy: string;
}
