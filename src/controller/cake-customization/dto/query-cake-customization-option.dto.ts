import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min, IsEnum, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CakeCustomizationType } from '../entities/cake-customization-option.entity';

export class QueryCakeCustomizationOptionDto {
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

  @ApiPropertyOptional({
    enum: CakeCustomizationType,
    isArray: true,
    description: 'Filter by one or more option types (e.g., shape, flavor)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  @IsArray()
  @IsEnum(CakeCustomizationType, { each: true })
  type?: CakeCustomizationType[];
}
