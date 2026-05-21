import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ComplaintStatus } from '../entities/review.entity';

export class QueryReviewDto {
  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description:
      'Number of items per page. Omit to return all items (no pagination).',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by outlet ID' })
  @IsOptional()
  @IsMongoId()
  outletId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by complaint-only reviews' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isComplaint?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter by complaint status. Use "open" to include unresolved complaints.',
    enum: [...Object.values(ComplaintStatus), 'open'],
  })
  @IsOptional()
  @IsIn([...Object.values(ComplaintStatus), 'open'])
  complaintStatus?: ComplaintStatus | 'open';

  @ApiPropertyOptional({
    description: 'Filter by review severity bucket',
    enum: ['critical', 'concern'],
  })
  @IsOptional()
  @IsIn(['critical', 'concern'])
  severity?: 'critical' | 'concern';

  @ApiPropertyOptional({
    description: 'Exclude resolved and dismissed complaints',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  unresolvedOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Exclude resolved and dismissed complaints from results',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  excludeResolved?: boolean;
}
