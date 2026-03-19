import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  IsArray,
  IsMongoId,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { UserRole } from '../interfaces/user.interface';

export class CreateUserDto {
  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description:
      'Optional MongoDB _id for the user (used for minimal/find-or-create flows)',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  _id?: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'The unique name of the user',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'john_doe_99',
    description: 'The username of the user',
    required: false,
  })
  @IsString()
  @IsOptional()
  userName?: string;

  @ApiProperty({
    example: 'user',
    enum: UserRole,
    description: 'The role of the user',
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty({
    example: 'password123',
    description: 'The password of the user',
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'The phone number of the user',
    required: false,
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'The email of the user',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: ['60d5ecb86217152c9043e02d'],
    description: 'Array of outlet IDs associated with the user',
    required: false,
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  outlets?: string[];

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated address ID',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  addressId?: string;

  @ApiProperty({
    example: '1990-05-15',
    description: 'Date of birth (ISO date string)',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiProperty({
    example: 'male',
    description: 'Gender',
    required: false,
  })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiProperty({
    example: '2025-02-21T12:00:00.000Z',
    description: 'Timestamp of the user’s last login (ISO 8601)',
    required: false,
    type: String,
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  lastLoginAt?: string;

  @ApiProperty({
    example: true,
    description: 'Whether the user is active',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether the user is deleted',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isDeleted?: boolean;

  @ApiProperty({
    example: '123456',
    description: 'The OTP of the user',
    required: false,
  })
  @IsString()
  @IsOptional()
  otp?: string;
}
