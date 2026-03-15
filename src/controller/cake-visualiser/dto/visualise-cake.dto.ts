import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class VisualiseCakeDto {
  @ApiProperty({ description: 'Custom text for the cake', required: false })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({ description: 'Base cake image URL', required: false })
  @IsOptional()
  @IsString()
  baseImage?: string;

  @ApiProperty({ description: 'Shape of the cake', required: false })
  @IsOptional()
  @IsString()
  shape?: string;

  @ApiProperty({ description: 'Flavor of the cake', required: false })
  @IsOptional()
  @IsString()
  flavor?: string;

  @ApiProperty({
    description: 'Extra requests or decorations',
    required: false,
  })
  @IsOptional()
  @IsString()
  extraRequests?: string;
}
