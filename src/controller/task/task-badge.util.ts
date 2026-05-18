import { TaskPriority, TaskRecurrenceType } from './task.enums';

export type TaskBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface TaskBadge {
  key: string;
  label: string;
  tone: TaskBadgeTone;
}

type TaskBadgeSource = {
  taskCategory?: { _id?: string; name?: string; description?: string };
  priority?: TaskPriority;
  isRecurring?: boolean;
  recurrenceType?: TaskRecurrenceType;
};

export function buildTaskBadges(task: TaskBadgeSource): TaskBadge[] {
  const badges: TaskBadge[] = [];

  if (task.isRecurring) {
    badges.push({
      key: 'schedule',
      label:
        task.recurrenceType === TaskRecurrenceType.MONTHLY
          ? 'Monthly'
          : task.recurrenceType === TaskRecurrenceType.WEEKLY
            ? 'Weekly'
            : 'Recurring',
      tone: 'info',
    });
  }

  const categoryName = task.taskCategory?.name?.trim();
  if (categoryName) {
    badges.push({
      key: `category:${task.taskCategory?._id ?? categoryName.toLowerCase()}`,
      label: categoryName,
      tone: 'success',
    });
  }

  if (task.priority) {
    badges.push(getPriorityBadge(task.priority));
  }

  return badges;
}

function getPriorityBadge(priority: TaskPriority): TaskBadge {
  switch (priority) {
    case TaskPriority.LOW:
      return { key: 'priority', label: 'Low Priority', tone: 'neutral' };
    case TaskPriority.HIGH:
      return { key: 'priority', label: 'High Priority', tone: 'warning' };
    case TaskPriority.MEDIUM:
    default:
      return { key: 'priority', label: 'Medium Priority', tone: 'info' };
  }
}
