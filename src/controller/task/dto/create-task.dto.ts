import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TaskCategory, TaskPriority, TaskStatus } from '../task.enums';

export class CreateTaskDto {
  @ApiProperty({ description: 'Task description', example: 'Clean prep area' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description: string;

  @ApiProperty({ enum: TaskCategory })
  @IsEnum(TaskCategory)
  category: TaskCategory;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.OPEN })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ description: 'Due date (ISO 8601)' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ description: 'Outlet ID' })
  @IsMongoId()
  outletId: string;

  @ApiPropertyOptional({
    description: 'Manager user IDs for this outlet',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videoUrls?: string[];
}
