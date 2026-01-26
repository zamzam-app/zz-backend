// import { ApiProperty } from '@nestjs/swagger';
// import {
//   IsArray,
//   IsEnum,
//   IsNotEmpty,
//   IsNumber,
//   IsOptional,
//   IsString,
//   ValidateNested,
//   IsMongoId,
// } from 'class-validator';
// import { Type } from 'class-transformer';
// import { FieldType } from '../entities/form.entity';
// import { IsValidFormInput } from './form-input.validator';

// export class FormFieldDto {
//   @ApiProperty({
//     example: 'field_1',
//     description: 'Unique identifier for the field',
//   })
//   @IsString()
//   @IsNotEmpty()
//   field_id: string;

//   @ApiProperty({
//     example: 'What is your name?',
//     description: 'Label for the field',
//   })
//   @IsString()
//   @IsNotEmpty()
//   field_label: string;

//   @ApiProperty({
//     example: FieldType.ShortAnswer,
//     description: 'Type of the field',
//     enum: FieldType,
//   })
//   @IsEnum(FieldType)
//   field_type: FieldType;

//   @ApiProperty({
//     description:
//       'Input value - text for ShortAnswer, textarea for Paragraph, radiobutton selection for MultipleChoice, checkbox selections for Checkboxes, number (1-5) for StarRating',
//     required: false,
//     examples: {
//       ShortAnswer: 'John Doe',
//       Paragraph: 'This is a longer text response...',
//       MultipleChoice: 'Option A',
//       Checkboxes: ['Option A', 'Option C'],
//       StarRating: 4,
//     },
//   })
//   @IsOptional()
//   @IsValidFormInput()
//   input?: string | string[] | number;
// }

// export class CreateFormDto {
//   @ApiProperty({ example: 1, description: 'Version number of the form' })
//   @IsNumber()
//   version: number;

//   @ApiProperty({
//     example: [
//       {
//         field_id: 'field_1',
//         field_label: 'What is your name?',
//         field_type: FieldType.ShortAnswer,
//         input: 'John Doe',
//       },
//       {
//         field_id: 'field_2',
//         field_label: 'Tell us about yourself',
//         field_type: FieldType.Paragraph,
//         input: 'I am a software developer...',
//       },
//     ],
//     description: 'Array of form fields',
//     type: [FormFieldDto],
//   })
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => FormFieldDto)
//   fields: FormFieldDto[];

//   @ApiProperty({
//     example: '60d5ecb86217152c9043e02d',
//     description: 'Associated user ID',
//     required: false,
//   })
//   @IsMongoId()
//   @IsOptional()
//   userId?: string;
// }
