import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Display name of the user',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'The phone number of the user',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    example: '1990-05-15',
    description: 'Date of birth (ISO date string)',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dob?: string;
}
