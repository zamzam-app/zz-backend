import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ComplaintStatus } from '../entities/review.entity';

export class ResponseDto {
  @IsMongoId()
  @IsNotEmpty()
  questionId: string;

  @IsNotEmpty()
  answer: string | string[] | number;
}

export class CreateReviewDto {
  @IsMongoId()
  @IsNotEmpty()
  formId: string;

  @IsMongoId()
  @IsOptional()
  userId: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsMongoId()
  @IsNotEmpty()
  outletId: string;

  @IsMongoId()
  @IsOptional()
  outletTableId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResponseDto)
  @IsNotEmpty()
  response: ResponseDto[];

  @IsNumber()
  @IsOptional()
  totalRatings?: number;

  @IsNumber()
  @IsOptional()
  overallRating?: number;

  @IsBoolean()
  @IsOptional()
  isComplaint?: boolean;

  @IsEnum(ComplaintStatus)
  @IsOptional()
  complaintStatus?: ComplaintStatus;

  @IsString()
  @IsOptional()
  complaintReason?: string;

  @IsDateString()
  @IsOptional()
  resolvedAt?: string;

  @IsMongoId()
  @IsOptional()
  resolvedBy?: string;

  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}
