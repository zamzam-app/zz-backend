import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { OutletTableStatus } from '../entities/outlet-table.entity';

export class QueryOutletTableDto {
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

  @ApiPropertyOptional({ description: 'Filter by table status' })
  @IsOptional()
  @IsEnum(OutletTableStatus)
  status?: OutletTableStatus;

  @ApiPropertyOptional({ description: 'Search by table name' })
  @IsOptional()
  @IsString()
  name?: string;
}
