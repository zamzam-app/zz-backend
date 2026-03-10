import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutletService } from './outlet.service';
import { OutletController } from './outlet.controller';
import { Outlet, OutletSchema } from './entities/outlet.entity';
import { Form, FormSchema } from '../forms/entities/form.entity';
import { Question, QuestionSchema } from '../question/entities/question.entity';
import {
  OutletTable,
  OutletTableSchema,
} from '../outlet-table/entities/outlet-table.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Outlet.name, schema: OutletSchema },
      { name: Form.name, schema: FormSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: OutletTable.name, schema: OutletTableSchema },
    ]),
  ],
  controllers: [OutletController],
  providers: [OutletService],
  exports: [OutletService],
})
export class OutletModule {}
