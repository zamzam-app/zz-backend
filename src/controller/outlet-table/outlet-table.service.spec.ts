import { Test, TestingModule } from '@nestjs/testing';
import { OutletTableService } from './outlet-table.service';

describe('OutletTableService', () => {
  let service: OutletTableService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutletTableService],
    }).compile();

    service = module.get<OutletTableService>(OutletTableService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
