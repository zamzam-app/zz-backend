import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateUploadedCakeDto {
  @ApiProperty({
    description: 'User prompt used for the uploaded custom cake request',
    example: '2-tier vanilla cake with red flowers and Happy Birthday text',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  prompt: string;

  @ApiProperty({
    description: 'Final image URL after upload (e.g. Cloudinary)',
    example:
      'https://res.cloudinary.com/demo/image/upload/v123/uploaded-cakes/sample.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  imageUrl: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '+919876543210',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Date of birth (ISO date string)',
    example: '1990-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiProperty({
    description: 'Gender',
    example: 'male',
    enum: ['male', 'female'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['male', 'female'])
  gender?: string;

  @ApiProperty({
    description: 'Customer name',
    example: 'John Doe',
    required: false,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({
    description: 'Legacy reference image URL uploaded by client',
    example:
      'https://res.cloudinary.com/demo/image/upload/v123/uploaded-cakes/sample.jpg',
    required: false,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  referenceImageUrl?: string;

  @ApiProperty({
    description: 'Legacy customization request details from customer',
    example: '2-tier vanilla cake with red flowers and Happy Birthday text',
    required: false,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;
}
