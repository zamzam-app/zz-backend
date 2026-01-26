import { Test, TestingModule } from '@nestjs/testing';
import { OutletTypeController } from './outlet-type.controller';
import { OutletTypeService } from './outlet-type.service';

describe('OutletTypeController', () => {
  let controller: OutletTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OutletTypeController],
      providers: [OutletTypeService],
    }).compile();

    controller = module.get<OutletTypeController>(OutletTypeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
