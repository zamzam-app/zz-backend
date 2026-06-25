import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { Review, ReviewSchema } from './entities/review.entity';
import {
  PendingComplaint,
  PendingComplaintSchema,
} from './entities/pending-complaint.entity';
import { Form, FormSchema } from '../forms/entities/form.entity';
import { Question, QuestionSchema } from '../question/entities/question.entity';
import {
  OutletTable,
  OutletTableSchema,
} from '../outlet-table/entities/outlet-table.entity';
import { UsersModule } from '../users/users.module';
import { Msg91Module } from '../../integrations/msg91/msg91.module';
import { User, UserSchema } from '../users/entities/user.entity';
import { Outlet, OutletSchema } from '../outlet/entities/outlet.entity';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Form.name, schema: FormSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: OutletTable.name, schema: OutletTableSchema },
      { name: User.name, schema: UserSchema },
      { name: Outlet.name, schema: OutletSchema },
      {
        name: PendingComplaint.name,
        schema: PendingComplaintSchema,
      },
    ]),
    UsersModule,
    Msg91Module,
    NotificationsModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
