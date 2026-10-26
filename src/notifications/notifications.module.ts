import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../controller/users/users.module';
import { PushReceipt, PushReceiptSchema } from './entities/push-receipt.entity';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: PushReceipt.name, schema: PushReceiptSchema },
    ]),
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
