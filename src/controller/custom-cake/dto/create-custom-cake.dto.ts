import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateCustomCakeDto {
  @ApiProperty({
    description: 'User prompt used for the custom cake',
    example: 'Chocolate cake with "Happy Birthday" text',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({
    description: 'Final image URL after upload (e.g. Cloudinary)',
    example: 'https://res.cloudinary.com/.../custom-cakes/....png',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  imageUrl: string;
}
