import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TaskEventType } from '../task.enums';

/**
 * Query parameters for cursor-paginated timeline retrieval.
 *
 * Example:
 *   GET /tasks/:id/timeline?cursor=eyJzb3J0S2V5Ijoi...&limit=20&types[]=COMMENTED&types[]=ATTACHMENT_ADDED
 */
export class QueryTimelineDto {
  @ApiPropertyOptional({
    description:
      'Cursor for pagination (base64-encoded JSON sortKey). Omit for the first page.',
    example: 'eyJzb3J0S2V5IjoibTBkOGYxLWExYjJjM2Q0In0=',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of events per page (max 100).',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description:
      'Filter by one or more event types. If omitted, returns all types.',
    isArray: true,
    enum: TaskEventType,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TaskEventType, { each: true })
  types?: TaskEventType[];
}

/**
 * Query parameters for fetching a task detail with its first page of events.
 *
 * Used by the "GET /tasks/:id" endpoint to return both the task summary
 * and the initial timeline page in a single response.
 */
export class QueryTaskDetailDto {
  @ApiPropertyOptional({
    description:
      'Number of initial timeline events to include (default 20, max 50).',
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  initialTimelineLimit?: number = 20;
}
