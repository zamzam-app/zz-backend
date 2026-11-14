import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

export class QueryPublicReviewsDto {
  @ApiPropertyOptional({ description: 'Filter by outlet ID' })
  @IsOptional()
  @IsMongoId()
  outletId?: string;

  @ApiPropertyOptional({
    description: 'Number of reviews to return',
    default: 6,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
