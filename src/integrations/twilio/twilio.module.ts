import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TwilioVerifyService } from './twilio-verify.service';

@Module({
  imports: [ConfigModule],
  providers: [TwilioVerifyService],
  exports: [TwilioVerifyService],
})
export class TwilioModule {}
