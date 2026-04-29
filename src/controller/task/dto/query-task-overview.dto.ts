import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

export enum TaskOverviewPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class QueryTaskOverviewDto {
  @ApiPropertyOptional({
    enum: TaskOverviewPeriod,
    default: TaskOverviewPeriod.WEEKLY,
    description: 'Overview due-count period selector',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string' || value.trim() === '') {
      return TaskOverviewPeriod.WEEKLY;
    }
    return value.toLowerCase();
  })
  @IsEnum(TaskOverviewPeriod)
  period?: TaskOverviewPeriod = TaskOverviewPeriod.WEEKLY;
}
