import { Module } from '@nestjs/common';
import { OutletTypeService } from './outlet-type.service';
import { OutletTypeController } from './outlet-type.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { OutletType, OutletTypeSchema } from './entities/outlet-type.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OutletType.name, schema: OutletTypeSchema },
    ]),
  ],
  controllers: [OutletTypeController],
  providers: [OutletTypeService],
  exports: [OutletTypeService],
})
export class OutletTypeModule {}
