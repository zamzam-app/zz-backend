import {
  IsArray,
  IsMongoId,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderQuestionDto {
  @IsMongoId()
  questionId: string;

  @IsInt()
  @Min(0)
  order: number;
}

export class ReorderFormQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderQuestionDto)
  questions: ReorderQuestionDto[];
}
