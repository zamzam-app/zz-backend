import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType, Option } from '../entities/form.entity';

export class QuestionDto {
  @ApiProperty({
    example: 'short_answer',
    description: 'Type of the question',
    enum: QuestionType,
  })
  @IsEnum(QuestionType)
  @IsNotEmpty()
  type: QuestionType;

  @ApiProperty({
    example: 'What is your name?',
    description: 'Title of the question',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Please enter your full name',
    description: 'Hint for the question',
    required: false,
  })
  @IsString()
  @IsOptional()
  hint?: string;

  @ApiProperty({
    example: [{ text: 'Option 1' }, { text: 'Option 2' }],
    description: 'Array of options for multiple choice or checkbox questions',
    type: [Object],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  @IsOptional()
  options?: Option[];

  @ApiProperty({
    example: true,
    description: 'Whether the question is required',
  })
  @IsNotEmpty()
  isRequired: boolean;

  @ApiProperty({
    example: 5,
    description: 'Maximum rating for star rating questions',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  maxRatings?: number;
}

export class CreateFormDto {
  @ApiProperty({
    example: 'Customer Feedback Form',
    description: 'Title of the form',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 1, description: 'Version number of the form' })
  @IsNumber()
  @IsOptional()
  version?: number;

  @ApiProperty({
    example: [
      {
        type: QuestionType.ShortAnswer,
        title: 'What is your name?',
        hint: 'Please enter your full name',
        isRequired: true,
      },
      {
        type: QuestionType.Paragraph,
        title: 'Tell us about yourself',
        isRequired: false,
      },
    ],
    description: 'Array of form questions',
    type: [QuestionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions: QuestionDto[];

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated user ID',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  userId?: string;
}
