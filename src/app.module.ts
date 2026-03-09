import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import * as dns from 'dns';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './controller/users/users.module';
import { AuthModule } from './controller/auth/auth.module';
import { AddressModule } from './controller/address/address.module';
import { ProductModule } from './controller/product/product.module';
import { OutletModule } from './controller/outlet/outlet.module';
import { OutletTypeModule } from './controller/outlet-type/outlet-type.module';
import { FormModule } from './controller/forms/form.module';
import { QuestionModule } from './controller/question/question.module';
import { ReviewModule } from './controller/review/review.module';
import { UploadModule } from './controller/upload/upload.module';
import { OutletTableModule } from './controller/outlet-table/outlet-table.module';
import { CategoryModule } from './controller/category/category.module';

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
    QuestionModule,
    ReviewModule,
    UploadModule,
    OutletTableModule,
    CategoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
