import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { ProductType } from '../entities/product.entity';

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
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated ratings ID',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  ratingsId?: string;

  @ApiProperty({
    example: ['image1.jpg', 'image2.jpg'],
    description: 'Array of product image URLs',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  images: string[];

  @ApiProperty({
    example: 'premade',
    enum: ProductType,
    description: 'Type of product',
  })
  @IsEnum(ProductType)
  @IsNotEmpty()
  type: ProductType;
}
