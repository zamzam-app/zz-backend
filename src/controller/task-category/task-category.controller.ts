import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/interfaces/user.interface';
import { CreateTaskCategoryDto } from './dto/create-task-category.dto';
import { QueryTaskCategoryDto } from './dto/query-task-category.dto';
import {
  ApiTaskCategoryCreate,
  ApiTaskCategoryFindAll,
  ApiTaskCategoryFindOne,
  ApiTaskCategoryRemove,
  ApiTaskCategoryUpdate,
} from './dto/task-category.swagger';
import { UpdateTaskCategoryDto } from './dto/update-task-category.dto';
import { TaskCategoryService } from './task-category.service';

@ApiTags('task-category')
@Controller('task-category')
export class TaskCategoryController {
  constructor(private readonly taskCategoryService: TaskCategoryService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiTaskCategoryCreate()
  create(@Body() createTaskCategoryDto: CreateTaskCategoryDto) {
    return this.taskCategoryService.create(createTaskCategoryDto);
  }

  @Get()
  @Public()
  @ApiTaskCategoryFindAll()
  findAll(@Query() query: QueryTaskCategoryDto) {
    return this.taskCategoryService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiTaskCategoryFindOne()
  findOne(@Param('id') id: string) {
    return this.taskCategoryService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiTaskCategoryUpdate()
  update(
    @Param('id') id: string,
    @Body() updateTaskCategoryDto: UpdateTaskCategoryDto,
  ) {
    return this.taskCategoryService.update(id, updateTaskCategoryDto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiTaskCategoryRemove()
  remove(@Param('id') id: string) {
    return this.taskCategoryService.remove(id);
  }
}
