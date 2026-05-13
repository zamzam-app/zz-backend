import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum UploadKind {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
}

export class UploadSignatureQueryDto {
  @ApiPropertyOptional({
    description: 'Cloudinary folder (e.g. products, outlets, avatars)',
    example: 'tasks',
  })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({
    description: 'Kind of upload to determine resource type',
    enum: UploadKind,
    default: UploadKind.IMAGE,
  })
  @IsOptional()
  @IsEnum(UploadKind)
  kind?: UploadKind;
}
