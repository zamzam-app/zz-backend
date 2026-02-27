import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { OutletTableStatus } from '../entities/outlet-table.entity';

export class CreateOutletTableDto {
  @ApiProperty({ example: '67f5f9e8f9a7f7468486a0ff' })
  @IsMongoId()
  @IsNotEmpty()
  outletId: string;

  @ApiProperty({ example: '67f5f9e8f9a7f7468486a100' })
  @IsMongoId()
  @IsNotEmpty()
  createdBy: string;

  @ApiProperty({ example: 'Table A1' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ enum: OutletTableStatus })
  @IsOptional()
  @IsEnum(OutletTableStatus)
  status?: OutletTableStatus;
}
