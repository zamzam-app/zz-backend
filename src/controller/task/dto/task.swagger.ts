import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
} from '@nestjs/swagger';

export class TaskOverviewResponseSwagger {
  @ApiProperty({ example: 25 })
  totalOpenTasks!: number;

  @ApiProperty({ example: 80 })
  completedTasks!: number;

  @ApiProperty({ example: 6 })
  dueTodayTasks!: number;

  @ApiProperty({ example: 4 })
  criticalOpenTasks!: number;

  @ApiProperty({ example: '2026-04-27' })
  snapshotDate!: string;

  @ApiProperty({ example: 'weekly', enum: ['daily', 'weekly', 'monthly'] })
  period!: string;

  @ApiProperty({ example: 14 })
  dueInPeriodTasks!: number;

  @ApiProperty({ example: 14 })
  dueThisWeekTasks!: number;

  @ApiProperty({ example: 42 })
  dueThisMonthTasks!: number;
}

export function ApiTaskCreate() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a task' }),
    ApiCreatedResponse({ description: 'Task created' }),
  );
}

export function ApiTaskFindAll() {
  return applyDecorators(
    ApiOperation({
      summary: 'List tasks with filters and pagination',
      description:
        'Returns tasks with backend-side filtering (status, priority, search, due date range) and pagination for board/infinite-scroll UI. Managers only see tasks for their allowed scope.',
    }),
    ApiOkResponse({ description: 'Paginated task list' }),
  );
}

export function ApiTaskFindOne() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a task by ID' }),
    ApiOkResponse({ description: 'Task with relations' }),
    ApiNotFoundResponse({ description: 'Task not found' }),
  );
}

export function ApiTaskFindByAssignee() {
  return applyDecorators(
    ApiOperation({
      summary: 'List tasks by assignee userId',
      description: 'Returns tasks where the user is an assignee.',
    }),
    ApiOkResponse({ description: 'Paginated task list' }),
  );
}

export function ApiTaskOverview() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get task overview metrics',
      description:
        'Returns open/completed counts plus due counts for daily/weekly/monthly windows (business timezone: Asia/Kolkata).',
    }),
    ApiOkResponse({
      description: 'Task overview fetched',
      type: TaskOverviewResponseSwagger,
    }),
  );
}

export function ApiTaskUpdate() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a task' }),
    ApiOkResponse({ description: 'Updated task' }),
    ApiNotFoundResponse({ description: 'Task not found' }),
  );
}

export function ApiTaskUpdateStatus() {
  return applyDecorators(
    ApiOperation({ summary: 'Update task status only' }),
    ApiOkResponse({ description: 'Updated task' }),
    ApiNotFoundResponse({ description: 'Task not found' }),
  );
}

export function ApiTaskRemove() {
  return applyDecorators(
    ApiOperation({ summary: 'Soft-delete a task' }),
    ApiOkResponse({ description: 'Task removed' }),
    ApiNotFoundResponse({ description: 'Task not found' }),
  );
}
