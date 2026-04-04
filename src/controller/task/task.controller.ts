import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtPayload } from '../auth/interfaces/auth.interfaces';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/interfaces/user.interface';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import {
  ApiTaskCreate,
  ApiTaskFindAll,
  ApiTaskFindOne,
  ApiTaskRemove,
  ApiTaskUpdate,
  ApiTaskUpdateStatus,
} from './dto/task.swagger';
import { TaskService } from './task.service';

@ApiTags('tasks')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiTaskCreate()
  create(
    @Body() createTaskDto: CreateTaskDto,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskService.create(createTaskDto, req.user.sub, req.user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiTaskFindAll()
  findAll(
    @Query() query: QueryTaskDto,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    console.log('query', query);
    return this.taskService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiTaskFindOne()
  findOne(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskService.findOne(id, req.user);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiTaskUpdateStatus()
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskService.updateStatus(id, dto, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiTaskUpdate()
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskService.update(id, updateTaskDto, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiTaskRemove()
  remove(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskService.remove(id, req.user);
  }
}
