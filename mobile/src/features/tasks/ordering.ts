import { Priority, SortKey } from './types';

/**
 * Task ordering — mirror of backend/src/tasks/task-ordering.ts so the list can
 * re-sort instantly on device. Both files share the same test cases.
 *
 * Smart sort — "what should I do next?"
 * -------------------------------------
 *   score = 0.40·P + 0.45·D + 0.15·S
 *
 *   P  Priority          low 0.2 · medium 0.55 · high 1.0
 *   D  Deadline pressure e^(−hoursLeft / 36); overdue → 1 + up to 0.5 more over 48h
 *   S  Schedule          e^(−hoursUntil / 12) before the planned start,
 *                        0.6 + 0.4·e^(−hoursSince / 24) after it
 *
 * Completed tasks always sink below active ones, most recently finished first.
 */

export interface OrderableTask {
  priority: Priority;
  scheduledAt: Date | string;
  deadline?: Date | string | null;
  completed: boolean;
  completedAt?: Date | string | null;
  createdAt: Date | string;
}

const HOUR = 60 * 60 * 1000;

export const WEIGHTS = {
  priority: 0.4,
  deadline: 0.45,
  schedule: 0.15,
} as const;

export const PRIORITY_VALUE: Record<Priority, number> = {
  low: 0.2,
  medium: 0.55,
  high: 1,
};

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const time = (value: Date | string | null | undefined): number | null =>
  value == null ? null : new Date(value).getTime();

/** D — how hard the deadline is pressing, 0 (none / far away) .. 1.5 (very late). */
export function deadlinePressure(
  deadline: Date | string | null | undefined,
  now: number,
): number {
  const due = time(deadline);
  if (due === null) {
    return 0;
  }
  const hoursLeft = (due - now) / HOUR;
  if (hoursLeft < 0) {
    return 1 + Math.min(-hoursLeft / 48, 1) * 0.5;
  }
  return Math.exp(-hoursLeft / 36);
}

/** S — how close the planned start time is to now. */
export function scheduleProximity(
  scheduledAt: Date | string,
  now: number,
): number {
  const start = time(scheduledAt) ?? now;
  const hours = (start - now) / HOUR;
  if (hours >= 0) {
    return Math.exp(-hours / 12);
  }
  return 0.6 + 0.4 * Math.exp(hours / 24);
}

/** Weighted contribution of each signal — used by the "why is this here?" breakdown. */
export function scoreBreakdown(task: OrderableTask, now: number = Date.now()) {
  if (task.completed) {
    return { priority: 0, deadline: 0, schedule: 0, total: 0 };
  }
  const priority = WEIGHTS.priority * PRIORITY_VALUE[task.priority];
  const deadline = WEIGHTS.deadline * deadlinePressure(task.deadline, now);
  const schedule = WEIGHTS.schedule * scheduleProximity(task.scheduledAt, now);
  return {
    priority,
    deadline,
    schedule,
    total: priority + deadline + schedule,
  };
}

/** Smart score of a single task (higher = do it sooner). Completed tasks score 0. */
export const smartScore = (
  task: OrderableTask,
  now: number = Date.now(),
): number => scoreBreakdown(task, now).total;

/** Ascending by time with missing values last. */
const byTimeAsc = (
  a: Date | string | null | undefined,
  b: Date | string | null | undefined,
) => {
  const ta = time(a);
  const tb = time(b);
  if (ta === tb) {
    return 0;
  }
  if (ta === null) {
    return 1;
  }
  if (tb === null) {
    return -1;
  }
  return ta - tb;
};

/** Stable tie-breaker shared by every sort: earliest deadline, then schedule, then newest. */
const tieBreak = (a: OrderableTask, b: OrderableTask) =>
  byTimeAsc(a.deadline, b.deadline) ||
  byTimeAsc(a.scheduledAt, b.scheduledAt) ||
  (time(b.createdAt) ?? 0) - (time(a.createdAt) ?? 0);

/** Returns a new array ordered by `sort`. Active tasks always come before completed ones. */
export function sortTasks<T extends OrderableTask>(
  tasks: readonly T[],
  sort: SortKey,
  now: number = Date.now(),
): T[] {
  const active = tasks.filter(t => !t.completed);
  const done = tasks
    .filter(t => t.completed)
    .sort((a, b) => (time(b.completedAt) ?? 0) - (time(a.completedAt) ?? 0));

  let compare: (a: T, b: T) => number;
  switch (sort) {
    case 'smart': {
      // Score once per task instead of once per comparison.
      const scores = new Map<T, number>(
        active.map(t => [t, smartScore(t, now)]),
      );
      compare = (a, b) => scores.get(b)! - scores.get(a)! || tieBreak(a, b);
      break;
    }
    case 'deadline':
      compare = (a, b) => byTimeAsc(a.deadline, b.deadline) || tieBreak(a, b);
      break;
    case 'scheduled':
      compare = (a, b) =>
        byTimeAsc(a.scheduledAt, b.scheduledAt) || tieBreak(a, b);
      break;
    case 'priority':
      compare = (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || tieBreak(a, b);
      break;
    case 'created':
      compare = (a, b) => (time(b.createdAt) ?? 0) - (time(a.createdAt) ?? 0);
      break;
  }

  return [...active.sort(compare), ...done];
}
