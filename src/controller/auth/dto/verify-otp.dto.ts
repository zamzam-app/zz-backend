import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  IsDateString,
} from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description:
      'Optional user ID to look up user by id instead of phone number',
    required: false,
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    example: '+1234567890',
    description:
      'The phone number of the user (used when userId is not provided)',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: '123456', description: 'The OTP sent to the user' })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({
    example: 'John Doe',
    description:
      'Display name (e.g. from feedback form). Stored on user when provided.',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'john@example.com',
    description:
      'Email (e.g. from feedback form). Stored on user when provided.',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '1990-05-15',
    description:
      'Date of birth ISO date string (e.g. from feedback form). Stored on user when provided.',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dob?: string;
}
