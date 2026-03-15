import { Module } from '@nestjs/common';
import { CakeVisualiserService } from './cake-visualiser.service';
import { CakeVisualiserController } from './cake-visualiser.controller';

@Module({
  controllers: [CakeVisualiserController],
  providers: [CakeVisualiserService],
  exports: [CakeVisualiserService],
})
export class CakeVisualiserModule {}
