import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ReviewService } from './review.service';
import { Review } from './entities/review.entity';
import { Form } from '../forms/entities/form.entity';
import { Question } from '../question/entities/question.entity';
import { OutletTable } from '../outlet-table/entities/outlet-table.entity';
import { Outlet } from '../outlet/entities/outlet.entity';
import { UsersService } from '../users/users.service';

describe('ReviewService', () => {
  let service: ReviewService;

  const mockReviewModel = {
    aggregate: jest.fn(),
  };
  const mockFormModel = {};
  const mockQuestionModel = {};
  const mockOutletTableModel = {};
  const mockOutletModel = {};
  const mockUsersService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        {
          provide: getModelToken(Review.name),
          useValue: mockReviewModel,
        },
        {
          provide: getModelToken(Form.name),
          useValue: mockFormModel,
        },
        {
          provide: getModelToken(Question.name),
          useValue: mockQuestionModel,
        },
        {
          provide: getModelToken(OutletTable.name),
          useValue: mockOutletTableModel,
        },
        {
          provide: getModelToken(Outlet.name),
          useValue: mockOutletModel,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFranchiseAnalytics', () => {
    it('should return franchise analytics data', async () => {
      const mockResults = [
        {
          outletId: 'outlet_1',
          outletName: 'Outlet 1',
          managerName: 'John Doe',
          csatScore: 4.0,
          metrics: {
            staff: 4.1,
            speed: 3.9,
            clean: 4.0,
            quality: 4.2,
            overall: 4.0,
          },
        },
      ];

      mockReviewModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResults),
      });

      const query = { period: undefined, startDate: undefined, endDate: undefined };
      const result = await service.getFranchiseAnalytics(query as any);

      expect(result).toHaveProperty('franchiseRanking');
      expect(result).toHaveProperty('metricsHeatmap');
      expect(result.franchiseRanking).toHaveLength(1);
      expect(result.franchiseRanking[0].rank).toBe(1);
      expect(result.franchiseRanking[0].outletName).toBe('Outlet 1');
      expect(result.metricsHeatmap[0].metrics.staff).toBe(4.1);
    });
  });
});
