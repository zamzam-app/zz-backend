import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import {
  UploadedCake,
  UploadedCakeSchema,
} from './entities/uploaded-cake.entity';
import { UploadedCakesController } from './uploaded-cakes.controller';
import { UploadedCakesService } from './uploaded-cakes.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UploadedCake.name, schema: UploadedCakeSchema },
    ]),
    UsersModule,
  ],
  controllers: [UploadedCakesController],
  providers: [UploadedCakesService],
  exports: [UploadedCakesService],
})
export class UploadedCakesModule {}
