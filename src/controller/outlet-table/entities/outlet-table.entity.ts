import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../common/entities/base.entity';

export type OutletTableDocument = HydratedDocument<OutletTable>;

export enum OutletTableStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
}

@Schema({ timestamps: true })
export class OutletTable extends BaseEntity {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Outlet',
    required: true,
  })
  outletId: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  tableToken: string;

  @Prop({ required: false, min: 1 })
  capacity?: number;

  @Prop({
    required: false,
    enum: OutletTableStatus,
    default: OutletTableStatus.AVAILABLE,
  })
  status?: OutletTableStatus;
}

export const OutletTableSchema = SchemaFactory.createForClass(OutletTable);
OutletTableSchema.index({ outletId: 1, name: 1 }, { unique: true });
