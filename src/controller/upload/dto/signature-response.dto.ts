import { ApiProperty } from '@nestjs/swagger';

export class SignatureResponseDto {
  @ApiProperty({
    description: 'Cloudinary API signature for signed upload',
    example: 'a1b2c3d4e5f6...',
  })
  signature: string;

  @ApiProperty({
    description: 'Unix timestamp used when generating the signature',
    example: 1700000000,
  })
  timestamp: number;

  @ApiProperty({
    description: 'Cloudinary cloud name',
    example: 'your_cloud_name',
  })
  cloudName: string;

  @ApiProperty({
    description: 'Cloudinary API key',
    example: '123456789012345',
  })
  apiKey: string;

  @ApiProperty({
    description:
      'Cloudinary folder for the upload (e.g. products, outlets, avatars)',
    example: 'uploads',
  })
  folder: string;

  @ApiProperty({
    description:
      'Cloudinary delivery type (e.g. upload, private, authenticated)',
    example: 'upload',
  })
  type: string;

  @ApiProperty({
    description: 'Cloudinary resource type (e.g. image, video, raw, auto)',
    example: 'image',
  })
  resourceType: string;
}
