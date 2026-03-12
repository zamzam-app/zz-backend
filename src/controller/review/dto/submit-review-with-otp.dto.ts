import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsMongoId,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ResponseDto } from './create-review.dto';

export class SubmitReviewWithOtpDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsDateString()
  @IsOptional()
  dob?: string;

  @IsMongoId()
  @IsNotEmpty()
  formId: string;

  @IsMongoId()
  @IsNotEmpty()
  outletId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResponseDto)
  @IsNotEmpty()
  response: ResponseDto[];

  @IsMongoId()
  @IsOptional()
  outletTableId?: string;

  @IsBoolean()
  @IsOptional()
  isComplaint?: boolean;

  @IsString()
  @IsOptional()
  complaintReason?: string;
}
