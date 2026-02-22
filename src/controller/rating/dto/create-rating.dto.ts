import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RatingType } from '../entities/rating.entity';

export class ResponseDto {
  @IsMongoId()
  @IsNotEmpty()
  questionId: string;

  @IsNotEmpty()
  answer: string | string[] | number;

  @IsOptional()
  @IsBoolean()
  isComplaint?: boolean;
}

export class CreateRatingDto {
  @IsMongoId()
  @IsNotEmpty()
  formId: string;

  @IsMongoId()
  @IsNotEmpty()
  userId: string;

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

  /** Overall rating 1–5. If omitted, derived from star-rating question or totalRatings. */
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  overallRating?: number;

  @IsEnum(RatingType)
  @IsOptional()
  type?: RatingType;
}
