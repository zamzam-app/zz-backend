import { Module } from '@nestjs/common';
import { OutletTypeService } from './outlet-type.service';
import { OutletTypeController } from './outlet-type.controller';

@Module({
  controllers: [OutletTypeController],
  providers: [OutletTypeService],
})
export class OutletTypeModule {}
