import { Test, TestingModule } from '@nestjs/testing';
import { OutletService } from './outlet.service';

describe('OutletService', () => {
  let service: OutletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutletService],
    }).compile();

    service = module.get<OutletService>(OutletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
