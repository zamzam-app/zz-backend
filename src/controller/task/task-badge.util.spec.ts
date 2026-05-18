import { TaskPriority, TaskRecurrenceType } from './task.enums';
import { buildTaskBadges } from './task-badge.util';

describe('buildTaskBadges', () => {
  it('returns task badge data for a normal task response', () => {
    const badges = buildTaskBadges({
      taskCategory: { _id: 'cat-1', name: 'Hygiene' },
      priority: TaskPriority.HIGH,
      isRecurring: false,
    });

    expect(badges).toEqual([
      { key: 'category:cat-1', label: 'Hygiene', tone: 'success' },
      { key: 'priority', label: 'High Priority', tone: 'warning' },
    ]);
  });

  it('returns recurring badge data and removes legacy single-badge behavior', () => {
    const badges = buildTaskBadges({
      taskCategory: { _id: 'cat-2', name: 'Inventory' },
      priority: TaskPriority.MEDIUM,
      isRecurring: true,
      recurrenceType: TaskRecurrenceType.WEEKLY,
    });

    expect(badges).toEqual([
      { key: 'schedule', label: 'Weekly', tone: 'info' },
      { key: 'category:cat-2', label: 'Inventory', tone: 'success' },
      { key: 'priority', label: 'Medium Priority', tone: 'info' },
    ]);
    expect(
      (badges as Array<{ badge?: string }>).every((badge) => !badge.badge),
    ).toBe(true);
  });
});
