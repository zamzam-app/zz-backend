import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CakeCustomizationType } from '../entities/cake-customization-option.entity';
import { Transform } from 'class-transformer';

export class CreateCakeCustomizationOptionDto {
  @ApiProperty({ example: 'Round Shape', description: 'Name of the option' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  @ApiProperty({ example: 150, description: 'Price of the option', minimum: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    example: 'INR',
    description: 'Currency code',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  currency?: string;

  @ApiProperty({
    enum: CakeCustomizationType,
    description: 'Type of customization option',
  })
  @IsEnum(CakeCustomizationType)
  type: CakeCustomizationType;
}
