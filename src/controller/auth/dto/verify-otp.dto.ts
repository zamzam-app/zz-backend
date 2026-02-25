import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
