import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdatePushTokenDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  pushToken: string;

  @IsOptional()
  @IsString()
  @IsIn(['ios', 'android', 'unknown'])
  platform?: 'ios' | 'android' | 'unknown';

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}
