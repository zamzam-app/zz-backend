import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateUploadedCakeDto {
  @ApiProperty({
    description: 'Customer name',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '+919876543210',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Reference image URL uploaded by client',
    example:
      'https://res.cloudinary.com/demo/image/upload/v123/uploaded-cakes/sample.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  referenceImageUrl: string;

  @ApiProperty({
    description: 'Customization request details from customer',
    example: '2-tier vanilla cake with red flowers and Happy Birthday text',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description: string;
}
