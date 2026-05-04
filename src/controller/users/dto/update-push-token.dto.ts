import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePushTokenDto {
  @IsString()
  @IsNotEmpty()
  pushToken: string;
}
