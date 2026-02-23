import { Question } from '../../question/entities/question.entity';

export interface IForm {
  _id?: string;
  title: string;
  questions: Question[];
  version?: number;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
