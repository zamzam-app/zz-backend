import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class MarkReviewReadDto {
  @ApiProperty({ description: 'Viewer user ID' })
  @IsMongoId()
  userId!: string;
}
