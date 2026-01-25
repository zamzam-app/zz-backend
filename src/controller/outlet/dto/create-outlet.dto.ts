import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { OutletType } from '../entities/outlet.entity';

export class CreateOutletDto {
  @ApiProperty({ example: 'Downtown Bistro', description: 'Outlet name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'A cozy bistro in the city center.',
    description: 'Outlet description',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: ['image1.jpg', 'image2.jpg'],
    description: 'Array of outlet image URLs',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  images: string[];

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated address ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  addressId: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated manager ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  managerId: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated form ID',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  formId?: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated product template ID',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  productTemplateId?: string;

  @ApiProperty({
    example: 'restaurant',
    enum: OutletType,
    description: 'Type of outlet',
  })
  @IsEnum(OutletType)
  @IsNotEmpty()
  type: OutletType;
}
