import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AnalyticsPeriod } from './query-global-csat.dto';

export class QueryCsatTrendlineDto {
  @ApiPropertyOptional({
    description: 'Trendline period',
    enum: AnalyticsPeriod,
    example: AnalyticsPeriod.MONTHLY,
    default: AnalyticsPeriod.MONTHLY,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.MONTHLY;
}
