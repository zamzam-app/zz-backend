import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ example: '123 Main St', description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: 'Springfield', description: 'City name' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: '627001', description: 'Pincode/Zip code' })
  @IsString()
  @IsNotEmpty()
  pincode: string;

  @ApiProperty({ example: 'Tirunelveli', description: 'District name' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ example: 'Tamil Nadu', description: 'State name' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: 'India', description: 'Country name' })
  @IsString()
  @IsOptional()
  country: string = 'India';

  @ApiProperty({
    example: 'https://maps.google.com/?q=...',
    description: 'Google Maps link',
    required: false,
  })
  @IsString()
  @IsOptional()
  mapLink?: string;

  @ApiProperty({
    example: '+919876543210',
    description: 'Contact phone number',
    required: false,
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated outlet ID',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  outletId?: string;

  @ApiProperty({
    example: '60d5ecb86217152c9043e02d',
    description: 'Associated user ID',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  userId?: string;
}
