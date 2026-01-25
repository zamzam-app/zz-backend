import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
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
}
