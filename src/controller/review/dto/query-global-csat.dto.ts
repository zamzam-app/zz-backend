import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum AnalyticsPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class QueryGlobalCsatDto {
  @ApiPropertyOptional({
    description: 'Preset date range used for analytics',
    enum: AnalyticsPeriod,
    example: AnalyticsPeriod.MONTHLY,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({
    description:
      'Custom range start date in ISO format. Must be sent together with endDate.',
    example: '2026-02-09T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'Custom range end date in ISO format. Must be sent together with startDate.',
    example: '2026-03-10T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
