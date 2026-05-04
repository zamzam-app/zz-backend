import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { TaskPriority, TaskStatus, TaskRecurrenceType } from '../task.enums';

export class TaskAttachmentsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  audios?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  files?: string[];
}

export class TaskSubmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  text?: string;

  @ApiPropertyOptional({ type: TaskAttachmentsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TaskAttachmentsDto)
  attachments?: TaskAttachmentsDto;
}

export class CreateTaskDto {
  @ApiProperty({ description: 'Task description', example: 'Clean prep area' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description: string;

  @ApiProperty({ description: 'Task category ID' })
  @IsMongoId()
  taskCategoryId: string;

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

  @ApiPropertyOptional({ description: 'Is the task recurring?' })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ enum: TaskRecurrenceType })
  @IsOptional()
  @IsEnum(TaskRecurrenceType)
  recurrenceType?: TaskRecurrenceType;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  recurrenceDays?: number[];

  @ApiProperty({ description: 'Outlet ID' })
  @IsOptional()
  @IsMongoId()
  outletId?: string;

  @ApiPropertyOptional({
    description: 'Manager user IDs for this task',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({ type: () => TaskSubmissionDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TaskSubmissionDto)
  adminSubmission?: TaskSubmissionDto;

  @ApiPropertyOptional({ type: () => TaskSubmissionDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TaskSubmissionDto)
  managerSubmission?: TaskSubmissionDto;
}
