import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomCake, CustomCakeSchema } from './entities/custom-cake.entity';
import { CustomCakeController } from './custom-cake.controller';
import { CustomCakeService } from './custom-cake.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomCake.name, schema: CustomCakeSchema },
    ]),
    UsersModule,
  ],
  controllers: [CustomCakeController],
  providers: [CustomCakeService],
  exports: [CustomCakeService],
})
export class CustomCakeModule {}
