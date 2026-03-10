import { ComplaintStatus } from '../entities/review.entity';

export interface IUserResponse {
  questionId: string;
  answer: string | string[] | number;
}

export interface IReview {
  _id?: string;
  isActive: boolean;
  isDeleted: boolean;
  userId: string;
  outletId: string;
  outletTableId?:
    | string
    | { id: string; name: string; tableToken: string }
    | null;
  userResponses: IUserResponse[];
  overallRating: number;
  formId?: string;
  isComplaint?: boolean;
  complaintStatus?: ComplaintStatus;
  complaintReason?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
