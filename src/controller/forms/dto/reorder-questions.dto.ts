import { IsArray, IsMongoId, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderQuestionDto {
  @IsMongoId()
  questionId: string;

  @IsNumber()
  order: number;
}

export class ReorderFormQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderQuestionDto)
  questions: ReorderQuestionDto[];
}
