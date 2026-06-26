import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'manager_01',
    description: 'Manager username for login',
    required: false,
  })
  @IsString()
  @IsOptional()
  userName?: string;

  @ApiProperty({
    example: 'ExpoPushToken[xxxx]',
    description: 'Optional push notification token for the device',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/\S/, {
    message: 'Push token must not be empty or contain only whitespace',
  })
  pushToken?: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Legacy name identifier for login (backward compatibility)',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'Admin email for login',
    required: false,
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: 'password123',
    description: 'The password of the user',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
