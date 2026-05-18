import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PricingOptionDto {
  @ApiProperty({ example: 1, description: 'Quantity value' })
  @IsNumber()
  @Min(0.00001)
  quantityValue: number;

  @ApiProperty({ example: 150, description: 'Pricing amount' })
  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Wireless Headphones', description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    type: [PricingOptionDto],
    description: 'Pricing options for the product',
    example: [
      { quantityValue: 0.5, quantityUnit: 'kg', amount: 200, currency: 'INR' },
      { quantityValue: 1, quantityUnit: 'kg', amount: 380, currency: 'INR' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PricingOptionDto)
  pricing: PricingOptionDto[];

  @ApiProperty({
    example: 'High-quality wireless headphones with noise cancellation.',
    description: 'Product description',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: ['image1.jpg', 'image2.jpg'],
    description: 'Array of product image URLs',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  images: string[];

  @ApiProperty({ example: true, description: 'Whether the product is active' })
  @IsBoolean()
  @IsOptional()
  isActive: boolean;

  @ApiPropertyOptional({
    example: ['60d5ecb86217152c9043e02d'],
    description: 'Array of category IDs this product belongs to',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryList?: string[];
}
