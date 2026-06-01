import { Question } from '../../question/entities/question.entity';

export interface IFormQuestion extends Question {
  order?: number;
}

export interface IForm {
  _id?: string;
  title: string;
  questions: IFormQuestion[];
  version?: number;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
