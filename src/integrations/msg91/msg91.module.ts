import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { Msg91Service } from './msg91.service';

@Module({
  imports: [HttpModule],
  providers: [Msg91Service],
  exports: [Msg91Service],
})
export class Msg91Module {}
