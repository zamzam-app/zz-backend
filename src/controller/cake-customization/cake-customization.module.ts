import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CakeCustomizationService } from './cake-customization.service';
import { CakeCustomizationController } from './cake-customization.controller';
import {
  CakeCustomizationOption,
  CakeCustomizationOptionSchema,
} from './entities/cake-customization-option.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: CakeCustomizationOption.name,
        schema: CakeCustomizationOptionSchema,
      },
    ]),
  ],
  controllers: [CakeCustomizationController],
  providers: [CakeCustomizationService],
  exports: [CakeCustomizationService],
})
export class CakeCustomizationModule {}
