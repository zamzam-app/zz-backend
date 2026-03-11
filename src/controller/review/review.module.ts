import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { Review, ReviewSchema } from './entities/review.entity';
import { Form, FormSchema } from '../forms/entities/form.entity';
import { Question, QuestionSchema } from '../question/entities/question.entity';
import {
  OutletTable,
  OutletTableSchema,
} from '../outlet-table/entities/outlet-table.entity';
import { Outlet, OutletSchema } from '../outlet/entities/outlet.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Form.name, schema: FormSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: OutletTable.name, schema: OutletTableSchema },
      { name: Outlet.name, schema: OutletSchema },
    ]),
    UsersModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
