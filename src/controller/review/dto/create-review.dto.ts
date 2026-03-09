import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
}
