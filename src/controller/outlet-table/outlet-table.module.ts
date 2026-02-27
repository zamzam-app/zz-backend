import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutletTableService } from './outlet-table.service';
import { OutletTableController } from './outlet-table.controller';
import { OutletTable, OutletTableSchema } from './entities/outlet-table.entity';
import { Outlet, OutletSchema } from '../outlet/entities/outlet.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OutletTable.name, schema: OutletTableSchema },
      { name: Outlet.name, schema: OutletSchema },
    ]),
  ],
  controllers: [OutletTableController],
  providers: [OutletTableService],
})
export class OutletTableModule {}
