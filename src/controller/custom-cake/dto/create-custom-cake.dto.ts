import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateCustomCakeDto {
  @ApiProperty({
    description: 'User prompt used for the custom cake',
    example: 'Chocolate cake with "Happy Birthday" text',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({
    description: 'Final image URL after upload (e.g. Cloudinary)',
    example: 'https://res.cloudinary.com/.../custom-cakes/....png',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  imageUrl: string;

  @ApiProperty({
    description: 'Date of birth (ISO date string)',
    example: '1990-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiProperty({
    description:
      'Phone number (used to find or create the user to associate the cake with)',
    example: '+919876543210',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Gender',
    example: 'male',
    enum: ['male', 'female', 'other'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['male', 'female'])
  gender?: string;
}
