import { ApiProperty } from '@nestjs/swagger';

export class FranchiseRankingItemDto {
  @ApiProperty({ example: 1 })
  rank: number;

  @ApiProperty({ example: 'outlet_1' })
  outletId: string;

  @ApiProperty({ example: 'Outlet 1' })
  outletName: string;

  @ApiProperty({ example: 'John Doe', nullable: true })
  managerName: string | null;

  @ApiProperty({ example: 4.0 })
  csatScore: number;
}

export class MetricsDto {
  @ApiProperty({ example: 4.1 })
  staff: number;

  @ApiProperty({ example: 3.9 })
  speed: number;

  @ApiProperty({ example: 4.0 })
  clean: number;

  @ApiProperty({ example: 4.2 })
  quality: number;

  @ApiProperty({ example: 4.0 })
  overall: number;
}

export class MetricsHeatmapItemDto {
  @ApiProperty({ example: 'outlet_1' })
  outletId: string;

  @ApiProperty({ example: 'Outlet 1' })
  outletName: string;

  @ApiProperty({ type: MetricsDto })
  metrics: MetricsDto;
}

export class FranchiseAnalyticsResponseDto {
  @ApiProperty({ type: [FranchiseRankingItemDto] })
  franchiseRanking: FranchiseRankingItemDto[];

  @ApiProperty({ type: [MetricsHeatmapItemDto] })
  metricsHeatmap: MetricsHeatmapItemDto[];
}
