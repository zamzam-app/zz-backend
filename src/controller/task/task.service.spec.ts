import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TaskService } from './task.service';
import { Task } from './entities/task.entity';
import { Outlet } from '../outlet/entities/outlet.entity';
import { TaskCategory } from '../task-category/entities/task-category.entity';
import { User } from '../users/entities/user.entity';
import { Types } from 'mongoose';
import { UserRole } from '../users/interfaces/user.interface';
import { TaskPriority, TaskStatus } from './task.enums';

describe('TaskService (Partial)', () => {
  let service: TaskService;
  let taskModel: any;
  let outletModel: any;
  let userModel: any;
  let taskCategoryModel: any;

  const mockTaskModel = {
    new: jest.fn().mockImplementation((dto) => ({
      ...dto,
      save: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), ...dto }),
    })),
    constructor: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
    updateOne: jest.fn(),
  };

  // Mocking the constructor-like behavior for "new this.taskModel"
  function MockTask(dto: any) {
    this._id = new Types.ObjectId();
    Object.assign(this, dto);
    this.save = jest.fn().mockResolvedValue(this);
  }

  const mockOutletModel = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockTaskCategoryModel = {
    findOne: jest.fn(),
  };

  const mockUserModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: getModelToken(Task.name),
          useValue: MockTask,
        },
        {
          provide: getModelToken(Outlet.name),
          useValue: mockOutletModel,
        },
        {
          provide: getModelToken(TaskCategory.name),
          useValue: mockTaskCategoryModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    // Assigning the model to the service manually because we used a constructor function for MockTask
    (service as any).taskModel = MockTask;
    (MockTask as any).findOne = mockTaskModel.findOne;
    (MockTask as any).aggregate = mockTaskModel.aggregate;
    (MockTask as any).updateOne = mockTaskModel.updateOne;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a task without an outlet', async () => {
      const dto = {
        description: 'Test task',
        taskCategoryId: new Types.ObjectId().toString(),
        dueDate: new Date().toISOString(),
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.OPEN,
      };

      const jwtUser = { sub: new Types.ObjectId().toString(), role: UserRole.ADMIN };

      mockTaskCategoryModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: dto.taskCategoryId }),
          }),
        }),
      });

      // findOneTaskById mock
      mockTaskModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
               _id: new Types.ObjectId(),
               outletId: null,
               assigneeIds: [],
               createdBy: new Types.ObjectId(jwtUser.sub)
            }),
          }),
        }),
      });

      mockTaskModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{
          description: 'Test task',
          outlet: null,
        }]),
      });

      const result = await service.create(dto as any, jwtUser.sub, jwtUser as any);
      expect(result).toBeDefined();
      expect(result.outlet).toBeNull();
    });
  });
});
