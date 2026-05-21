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
import { QueryTaskOverviewDto } from './dto/query-task-overview.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import {
  ApiTaskCreate,
  ApiTaskFindAll,
  ApiTaskOverview,
  ApiTaskFindOne,
  ApiTaskFindByAssignee,
  ApiTaskRemove,
  ApiTaskUpdate,
  ApiTaskUpdateStatus,
} from './dto/task.swagger';
import { TaskService } from './task.service';
import { TaskThreadQueryService } from './services/task-thread-query.service';
import { TaskViewService } from './services/task-view.service';
import { TaskDelegationService } from './services/task-delegation.service';
import {
  TaskAttachmentService,
  AttachmentFileInput,
} from './services/task-attachment.service';
import { AttachmentType } from './task.enums';
import { QueryTimelineDto, QueryTaskDetailDto } from './dto/timeline-query.dto';

@ApiTags('tasks')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskThreadQueryService: TaskThreadQueryService,
    private readonly taskViewService: TaskViewService,
    private readonly taskDelegationService: TaskDelegationService,
    private readonly taskAttachmentService: TaskAttachmentService,
  ) {}

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
    return this.taskService.findAll(query, req.user);
  }

  @Get('overview')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiTaskOverview()
  getOverview(
    @Query() query: QueryTaskOverviewDto,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskService.getOverview(req.user, query);
  }

  // ─── Static View & Unread Endpoints ───────────────────────────────────────

  @Post('view-all')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async markMultipleViewed(
    @Body() body: { taskIds: string[] },
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    await this.taskViewService.markMultipleTasksViewed(
      body.taskIds,
      req.user.sub,
    );
  }

  @Get('unread-count')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getUnreadCount(
    @Request() req: ExpressRequest & { user: JwtPayload },
    @Query('limit') limit?: number,
  ) {
    return this.taskViewService.getUnreadCount(req.user.sub, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('unread-aggregated')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getUnreadAggregated(
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskViewService.getAggregatedUnreadCount(req.user.sub);
  }

  @Get('unread-ids')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getUnreadIds(@Request() req: ExpressRequest & { user: JwtPayload }) {
    return this.taskViewService.getUnreadTaskIds(req.user.sub);
  }

  @Get('recently-viewed')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getRecentlyViewed(
    @Request() req: ExpressRequest & { user: JwtPayload },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.taskViewService.getRecentlyViewedTasks(
      req.user.sub,
      cursor,
      limit ? Number(limit) : 20,
    );
  }

  @Get('delegated-to-me')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getDelegatedToMe(
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskDelegationService.getActiveDelegationsForUser(req.user.sub);
  }

  @Get('my-delegations')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getMyDelegations(
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskDelegationService.getDelegationsByUser(req.user.sub);
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

  @Get('assignee/:userId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiTaskFindByAssignee()
  findByAssignee(
    @Param('userId') userId: string,
    @Query() query: QueryTaskDto,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskService.findByAssignee(userId, query, req.user);
  }

  // ─── Dynamic Task Thread / Detail Endpoints ────────────────────────────────

  @Get(':id/detail')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getTaskDetail(
    @Param('id') id: string,
    @Query() query: QueryTaskDetailDto,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskThreadQueryService.getTaskDetailWithTimeline(
      id,
      query.initialTimelineLimit,
      req.user.sub,
    );
  }

  @Get(':id/timeline')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getTimeline(@Param('id') id: string, @Query() query: QueryTimelineDto) {
    return this.taskThreadQueryService.getTimeline(id, query);
  }

  @Get(':id/events/type-counts')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getEventTypeCounts(@Param('id') id: string) {
    return this.taskThreadQueryService.getEventTypeCounts(id);
  }

  // ─── View Tracking Endpoints ─────────────────────────────────────────────

  @Post(':id/view')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async markViewed(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    await this.taskViewService.markTaskViewed(id, req.user.sub);
  }

  // ─── Delegation Endpoints ─────────────────────────────────────────────────

  @Post(':id/delegate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async delegateTask(
    @Param('id') id: string,
    @Body() body: { delegatedTo: string; note?: string },
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskDelegationService.delegateTask(
      id,
      req.user.sub,
      body.delegatedTo,
      body.note,
    );
  }

  @Post(':id/reassign')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async reassignTask(
    @Param('id') id: string,
    @Body() body: { newOwnerId: string; reason?: string },
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskDelegationService.reassignTask(
      id,
      req.user.sub,
      body.newOwnerId,
      body.reason,
    );
  }

  @Delete(':id/delegation')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async clearDelegation(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskDelegationService.clearDelegation(id, req.user.sub);
  }

  @Get(':id/delegations')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getDelegationHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ) {
    return this.taskDelegationService.getDelegationHistory(id, {
      limit: limit ? Number(limit) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  // ─── Attachment Endpoints ─────────────────────────────────────────────────

  @Post(':id/attachments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async addAttachments(
    @Param('id') id: string,
    @Body() body: { files: AttachmentFileInput[] },
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.taskAttachmentService.addAttachments(
      id,
      body.files,
      req.user.sub,
    );
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: ExpressRequest & { user: JwtPayload },
    @Body('reason') reason?: string,
  ) {
    return this.taskAttachmentService.removeAttachment(
      attachmentId,
      req.user.sub,
      reason,
    );
  }

  @Get(':id/attachments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getAttachments(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('type') type?: AttachmentType,
  ) {
    return this.taskAttachmentService.getTaskAttachments(id, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      type,
    });
  }
}
