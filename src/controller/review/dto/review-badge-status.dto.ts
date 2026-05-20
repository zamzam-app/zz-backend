import { ApiProperty } from '@nestjs/swagger';

export class ReviewBadgeStatusDto {
  @ApiProperty({ example: 3 })
  unreadCount!: number;

  @ApiProperty({ example: 5 })
  pendingCount!: number;

  @ApiProperty({ example: true })
  hasUnread!: boolean;
}
