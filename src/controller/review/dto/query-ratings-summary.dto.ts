import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class QueryRatingsSummaryDto {
  @ApiPropertyOptional({
    description: 'Filter rating summary by outlet ID',
    example: '60d5ecb86217152c9043e02d',
  })
  @IsOptional()
  @IsMongoId()
  outletId?: string;
}
