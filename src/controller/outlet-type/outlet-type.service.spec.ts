import { Test, TestingModule } from '@nestjs/testing';
import { OutletTypeService } from './outlet-type.service';

describe('OutletTypeService', () => {
  let service: OutletTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutletTypeService],
    }).compile();

    service = module.get<OutletTypeService>(OutletTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
