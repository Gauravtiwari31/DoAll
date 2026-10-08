import { sortTasks } from '@app/features/tasks/ordering';
import type { Category, Priority, SortKey, Task, TaskView } from './types';

/** The app's quick views (mobile/src/features/tasks/selectors.ts). */
export const VIEWS: { key: TaskView; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'all', label: 'All' },
  { key: 'done', label: 'Done' },
];

const ms = (iso: string | null) => (iso ? Date.parse(iso) : null);

const startOfDay = (now: number) => new Date(now).setHours(0, 0, 0, 0);
const endOfDay = (now: number) => new Date(now).setHours(23, 59, 59, 999);

export const isOverdue = (task: Task, now: number) => {
  const due = ms(task.deadline);
  return !task.completed && due !== null && due < now;
};

/**
 * - today:    planned for today or earlier and still open, due today, overdue,
 *             or finished today (so progress stays visible)
 * - upcoming: open tasks planned after today that are not overdue
 * - overdue:  open tasks whose deadline has passed
 */
export function matchesView(task: Task, view: TaskView, now: number): boolean {
  const todayEnd = endOfDay(now);
  switch (view) {
    case 'all':
      return true;
    case 'done':
      return task.completed;
    case 'overdue':
      return isOverdue(task, now);
    case 'upcoming':
      return !task.completed && ms(task.scheduledAt)! > todayEnd && !isOverdue(task, now);
    case 'today': {
      if (task.completed) {
        const done = ms(task.completedAt);
        return done !== null && done >= startOfDay(now);
      }
      const due = ms(task.deadline);
      return ms(task.scheduledAt)! <= todayEnd || (due !== null && due <= todayEnd);
    }
  }
}

export interface Filters {
  view: TaskView;
  search: string;
  priority: Priority | null;
  category: Category | null;
}

export function matchesFilters(task: Task, filters: Filters, now: number): boolean {
  if (!matchesView(task, filters.view, now)) {
    return false;
  }
  if (filters.priority && task.priority !== filters.priority) {
    return false;
  }
  if (filters.category && task.category !== filters.category) {
    return false;
  }
  const query = filters.search.trim().toLowerCase().replace(/^#/, '');
  return (
    !query ||
    task.title.toLowerCase().includes(query) ||
    task.description.toLowerCase().includes(query) ||
    task.tags.some(tag => tag.includes(query))
  );
}

export const visibleTasks = (tasks: Task[], filters: Filters, sort: SortKey, now: number) =>
  sortTasks(
    tasks.filter(task => matchesFilters(task, filters, now)),
    sort,
    now,
  );

export function viewCounts(tasks: Task[], now: number): Record<TaskView, number> {
  const counts: Record<TaskView, number> = { all: 0, today: 0, upcoming: 0, overdue: 0, done: 0 };
  for (const task of tasks) {
    for (const { key } of VIEWS) {
      if (matchesView(task, key, now)) {
        counts[key]++;
      }
    }
  }
  return counts;
}
