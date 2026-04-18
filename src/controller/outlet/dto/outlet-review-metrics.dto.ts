import { ApiProperty } from '@nestjs/swagger';

export class OutletReviewMetricsDto {
  @ApiProperty({
    example: 4.3,
    description:
      'Average overall rating for the outlet from non-deleted reviews, rounded to 1 decimal place',
  })
  rating!: number;

  @ApiProperty({
    example: 27,
    description: 'Count of non-deleted reviews for the outlet',
  })
  totalFeedback!: number;
}
