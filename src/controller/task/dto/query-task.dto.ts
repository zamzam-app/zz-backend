import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsBoolean,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../task.enums';

export class QueryTaskDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filter by outlet ID' })
  @IsOptional()
  @IsMongoId()
  outletId?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Filter by task category ID' })
  @IsOptional()
  @IsMongoId()
  @Transform(({ obj }: { obj: Record<string, string> }) => {
    const raw = obj.taskCategoryId ?? obj.taskCategoryid ?? obj.category;
    return raw === undefined || raw === '' ? undefined : raw;
  })
  taskCategoryId?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Filter tasks assigned to this user' })
  @IsOptional()
  @IsMongoId()
  @Transform(({ obj }: { obj: Record<string, string> }) => {
    const raw = obj.assigneeId ?? obj.assigneeid;
    return raw === undefined || raw === '' ? undefined : raw;
  })
  assigneeId?: string;

  @ApiPropertyOptional({
    description:
      'Case-insensitive search across description, task category name, outlet name, assignee name, and exact task ID.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  search?: string;

  @ApiPropertyOptional({
    description: 'Due date range start (ISO 8601, inclusive)',
  })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional({
    description: 'Due date range end (ISO 8601, inclusive)',
  })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiPropertyOptional({ description: 'Filter by recurring status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isRecurring?: boolean;
}
