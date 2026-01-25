import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ValidateUserDto {
  @IsString()
  @IsNotEmpty()
  pass: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  email?: string;
}
