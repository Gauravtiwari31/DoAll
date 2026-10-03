import { TaskPriority, TaskSort } from './task.constants';

/**
 * Task ordering
 * =============
 * The mobile app ships a mirror of this file (mobile/src/features/tasks/ordering.ts)
 * so lists re-sort instantly offline; both are covered by the same test cases.
 *
 * Smart sort — "what should I do next?"
 * -------------------------------------
 * Each active task gets a score from three signals normalised to 0..1:
 *
 *   score = 0.40·P + 0.45·D + 0.15·S
 *
 *   P  Priority          low 0.2 · medium 0.55 · high 1.0
 *   D  Deadline pressure e^(−hoursLeft / 36)
 *                        ≈1.00 due now · 0.51 in 24h · 0.14 in 72h · 0 without deadline.
 *                        Overdue tasks get 1 + up to 0.5 extra, growing over 48h, so
 *                        late work floats to the top and keeps climbing.
 *   S  Schedule          e^(−hoursUntil / 12) for tasks planned in the future
 *                        (a task planned for the next hour is "on deck");
 *                        0.6 + 0.4·e^(−hoursSince / 24) once its start time has
 *                        passed, so started-but-unfinished work stays visible.
 *
 * Deadline pressure carries the most weight because missing a deadline is the
 * costliest outcome; priority is a strong but not absolute signal (a low
 * priority task due in an hour beats a high priority task due next week).
 * Completed tasks always sink below active ones, most recently finished first.
 */

export interface OrderableTask {
  priority: TaskPriority;
  scheduledAt: Date | string;
  deadline?: Date | string | null;
  completed: boolean;
  completedAt?: Date | string | null;
  createdAt: Date | string;
}

const HOUR = 60 * 60 * 1000;

export const WEIGHTS = { priority: 0.4, deadline: 0.45, schedule: 0.15 } as const;

export const PRIORITY_VALUE: Record<TaskPriority, number> = {
  low: 0.2,
  medium: 0.55,
  high: 1,
};

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

const time = (value: Date | string | null | undefined): number | null =>
  value == null ? null : new Date(value).getTime();

/** D — how hard the deadline is pressing, 0 (none / far away) .. 1.5 (very late). */
export function deadlinePressure(deadline: Date | string | null | undefined, now: number): number {
  const due = time(deadline);
  if (due === null) return 0;
  const hoursLeft = (due - now) / HOUR;
  if (hoursLeft < 0) {
    return 1 + Math.min(-hoursLeft / 48, 1) * 0.5;
  }
  return Math.exp(-hoursLeft / 36);
}

/** S — how close the planned start time is to now. */
export function scheduleProximity(scheduledAt: Date | string, now: number): number {
  const start = time(scheduledAt) ?? now;
  const hours = (start - now) / HOUR;
  if (hours >= 0) return Math.exp(-hours / 12);
  return 0.6 + 0.4 * Math.exp(hours / 24);
}

/** Smart score of a single task (higher = do it sooner). Completed tasks score 0. */
export function smartScore(task: OrderableTask, now: number = Date.now()): number {
  if (task.completed) return 0;
  return (
    WEIGHTS.priority * PRIORITY_VALUE[task.priority] +
    WEIGHTS.deadline * deadlinePressure(task.deadline, now) +
    WEIGHTS.schedule * scheduleProximity(task.scheduledAt, now)
  );
}

/** Ascending by time with missing values last. */
const byTimeAsc = (a: Date | string | null | undefined, b: Date | string | null | undefined) => {
  const ta = time(a);
  const tb = time(b);
  if (ta === tb) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
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
  sort: TaskSort,
  now: number = Date.now(),
): T[] {
  const active = tasks.filter((t) => !t.completed);
  const done = tasks
    .filter((t) => t.completed)
    .sort((a, b) => (time(b.completedAt) ?? 0) - (time(a.completedAt) ?? 0));

  let compare: (a: T, b: T) => number;
  switch (sort) {
    case 'smart': {
      // Score once per task instead of once per comparison.
      const scores = new Map<T, number>(active.map((t) => [t, smartScore(t, now)]));
      compare = (a, b) => scores.get(b)! - scores.get(a)! || tieBreak(a, b);
      break;
    }
    case 'deadline':
      compare = (a, b) => byTimeAsc(a.deadline, b.deadline) || tieBreak(a, b);
      break;
    case 'scheduled':
      compare = (a, b) => byTimeAsc(a.scheduledAt, b.scheduledAt) || tieBreak(a, b);
      break;
    case 'priority':
      compare = (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || tieBreak(a, b);
      break;
    case 'created':
      compare = (a, b) => (time(b.createdAt) ?? 0) - (time(a.createdAt) ?? 0);
      break;
  }

  return [...active.sort(compare), ...done];
}
