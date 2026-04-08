import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaskCategoryDto {
  @ApiProperty({ example: 'Hygiene', description: 'Task category name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    example: 'Sanitation and cleanliness related tasks',
    description: 'Optional task category description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;
}
