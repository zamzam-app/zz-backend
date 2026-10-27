import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus } from '../entities/review.entity';

export class ResolveComplaintDto {
  @ApiProperty({
    example: 'resolved',
    enum: ComplaintStatus,
    description: 'New complaint status (resolved or dismissed)',
  })
  @IsEnum(ComplaintStatus)
  @IsNotEmpty()
  complaintStatus: ComplaintStatus;

  @ApiPropertyOptional({
    example: 'Issue addressed with the customer.',
    description: 'Notes describing the resolution or dismissal',
  })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  audios?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  files?: string[];

  @ApiPropertyOptional({
    example: '60d5ecb86217152c9043e02d',
    deprecated: true,
    description:
      'Ignored. The resolver is always the authenticated user. Still accepted so existing clients keep working.',
  })
  @IsOptional()
  @IsMongoId()
  resolvedBy?: string;
}
