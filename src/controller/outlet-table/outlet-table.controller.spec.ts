import { Test, TestingModule } from '@nestjs/testing';
import { OutletTableController } from './outlet-table.controller';
import { OutletTableService } from './outlet-table.service';

describe('OutletTableController', () => {
  let controller: OutletTableController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OutletTableController],
      providers: [OutletTableService],
    }).compile();

    controller = module.get<OutletTableController>(OutletTableController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
