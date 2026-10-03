import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../store';
import { endOfDay, startOfDay } from '../../utils/dates';
import { sortTasks } from './ordering';
import { tasksAdapter } from './tasksSlice';
import { Task, TaskFilters, TaskView, VIEWS } from './types';

export const { selectAll: selectAllTasks, selectById: selectTaskById } =
  tasksAdapter.getSelectors<RootState>(state => state.tasks);

export const selectFilters = (state: RootState) => state.tasks.filters;
export const selectSort = (state: RootState) => state.preferences.sort;
const selectNow = (_state: RootState, now: number) => now;

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

export const isOverdue = (task: Task, now: number) => {
  const due = ms(task.deadline);
  return !task.completed && due !== null && due < now;
};

/**
 * Which tasks belong to each quick view:
 * - today:    planned for today or earlier and still open, due today, overdue,
 *             or finished today (so progress stays visible)
 * - upcoming: open tasks planned after today that are not overdue
 * - overdue:  open tasks whose deadline has passed
 */
export function matchesView(task: Task, view: TaskView, now: number): boolean {
  const todayEnd = endOfDay(now).getTime();
  switch (view) {
    case 'all':
      return true;
    case 'done':
      return task.completed;
    case 'overdue':
      return isOverdue(task, now);
    case 'upcoming':
      return (
        !task.completed &&
        ms(task.scheduledAt)! > todayEnd &&
        !isOverdue(task, now)
      );
    case 'today': {
      if (task.completed) {
        const done = ms(task.completedAt);
        return done !== null && done >= startOfDay(now).getTime();
      }
      const due = ms(task.deadline);
      return (
        ms(task.scheduledAt)! <= todayEnd || (due !== null && due <= todayEnd)
      );
    }
  }
}

export function matchesFilters(
  task: Task,
  filters: TaskFilters,
  now: number,
): boolean {
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
  if (query) {
    return (
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query) ||
      task.tags.some(tag => tag.includes(query))
    );
  }
  return true;
}

/** The list on the home screen: current view + filters + chosen sort. */
export const selectVisibleTasks = createSelector(
  [selectAllTasks, selectFilters, selectSort, selectNow],
  (tasks, filters, sort, now) =>
    sortTasks(
      tasks.filter(task => matchesFilters(task, filters, now)),
      sort,
      now,
    ),
);

/** Badge counts for the view tabs (open tasks only, except "done"). */
export const selectViewCounts = createSelector(
  [selectAllTasks, selectNow],
  (tasks, now) => {
    const counts = Object.fromEntries(VIEWS.map(view => [view, 0])) as Record<
      TaskView,
      number
    >;
    for (const task of tasks) {
      for (const view of VIEWS) {
        if (
          (view === 'done' || !task.completed) &&
          matchesView(task, view, now)
        ) {
          counts[view]++;
        }
      }
    }
    return counts;
  },
);

/** Numbers for the hero card and the profile screen. */
export const selectDashboard = createSelector(
  [selectAllTasks, selectNow],
  (tasks, now) => {
    const today = tasks.filter(task => matchesView(task, 'today', now));
    const active = tasks.filter(task => !task.completed);
    const completed = tasks.length - active.length;
    return {
      total: tasks.length,
      active: active.length,
      completed,
      overdue: active.filter(task => isOverdue(task, now)).length,
      todayTotal: today.length,
      todayDone: today.filter(task => task.completed).length,
      completionRate: tasks.length === 0 ? 0 : completed / tasks.length,
      /** What the smart sort says to do next, whatever sort the list uses. */
      nextUp: sortTasks(active, 'smart', now)[0] ?? null,
    };
  },
);

export const selectActiveFilterCount = createSelector(
  [selectFilters],
  filters =>
    Number(filters.priority !== null) + Number(filters.category !== null),
);
