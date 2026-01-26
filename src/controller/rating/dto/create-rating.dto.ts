import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
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

  @IsEnum(RatingType)
  @IsOptional()
  type?: RatingType;
}
