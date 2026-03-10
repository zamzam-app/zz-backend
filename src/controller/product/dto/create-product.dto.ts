import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Wireless Headphones', description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 99.99, description: 'Product price' })
  @IsNumber()
  @IsNotEmpty()
  price: number;

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
