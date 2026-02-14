import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './controller/users/users.module';
import { AuthModule } from './controller/auth/auth.module';
import { AddressModule } from './controller/address/address.module';
import { ProductModule } from './controller/product/product.module';
import { OutletModule } from './controller/outlet/outlet.module';
import { OutletTypeModule } from './controller/outlet-type/outlet-type.module';
import { FormModule } from './controller/forms/form.module';
import { RatingModule } from './controller/rating/rating.module';
import * as dns from 'dns';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        dns.setServers(['1.1.1.1', '8.8.8.8']);
        return {
          uri: configService.get<string>('MONGO_URI'),
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    AddressModule,
    ProductModule,
    OutletModule,
    OutletTypeModule,
    FormModule,
    RatingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
