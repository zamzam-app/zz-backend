import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

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
        'Returns tasks with outlet, assignees, and creator for board UI. Managers only see tasks for their outlets.',
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
