import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { OutletTableStatus } from '../entities/outlet-table.entity';

export class UpdateOutletTableDto {
  @ApiPropertyOptional({ example: 'Table A1' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ enum: OutletTableStatus })
  @IsOptional()
  @IsEnum(OutletTableStatus)
  status?: OutletTableStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
