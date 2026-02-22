import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateOutletTypeDto {
  @ApiProperty({
    example: 'Restaurant',
    description: 'Name of the outlet type',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'A place where people can eat and dine',
    description: 'Description of the outlet type',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: ['60d5ecb86217152c9043e02d'],
    description: 'Array of menu object IDs',
    type: [String],
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  menu: string[];

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
    description: 'Default manager user ID',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  defaultManager?: string;
}
