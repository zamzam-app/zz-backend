import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

export class BaseEntity {
  @ApiProperty({
    example: true,
    description: 'Whether the record is active',
    default: true,
  })
  @Prop({ default: true })
  isActive: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether the record is marked as deleted',
    default: false,
  })
  @Prop({ default: false })
  isDeleted: boolean;
}
