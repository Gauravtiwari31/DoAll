import { nextOccurrence, sameRule } from '@app/features/tasks/recurrence';
import { deviceTimeZone } from '@app/utils/timezone';
import type { Task, TaskInput } from './types';

/*
 * Task changes, with the same rules as the app's tasksSlice
 * (mobile/src/features/tasks/tasksSlice.ts).
 */

/**
 * The time of a change. Sync keeps the version changed last, so a change is
 * always stamped after the one before it, even if the clock went back.
 */
export function stamp(previous?: string, now: number = Date.now()): string {
  const after = previous ? Date.parse(previous) + 1 : 0;
  return new Date(Math.max(now, after)).toISOString();
}

export function createTask(input: TaskInput, zone: string = deviceTimeZone()): Task {
  const now = stamp();
  return {
    ...input,
    id: crypto.randomUUID(),
    completed: false,
    completedAt: null,
    timeZone: zone,
    createdAt: now,
    updatedAt: now,
  };
}

export function editTask(
  current: Task,
  changes: Partial<TaskInput>,
  zone: string = deviceTimeZone(),
): Task {
  const next: Task = { ...current, ...changes, updatedAt: stamp(current.updatedAt) };
  // A new time was picked on this computer's clock: repeats follow its zone.
  if (next.scheduledAt !== current.scheduledAt || !sameRule(next.recurrence, current.recurrence)) {
    next.timeZone = zone;
  }
  return next;
}

/**
 * Ticks a task off, or back on. A repeating task isn't marked done: it moves
 * on to its next occurrence (the deadline moves with it).
 */
export function setCompleted(current: Task, completed: boolean, now: number = Date.now()): Task {
  const updatedAt = stamp(current.updatedAt, now);
  if (completed && current.recurrence) {
    const start = Date.parse(current.scheduledAt);
    const following = nextOccurrence(
      start,
      current.recurrence,
      current.timeZone,
      Math.max(start, now),
    );
    if (following !== null) {
      const shift = following - start;
      return {
        ...current,
        scheduledAt: new Date(following).toISOString(),
        deadline: current.deadline
          ? new Date(Date.parse(current.deadline) + shift).toISOString()
          : null,
        updatedAt,
      };
    }
  }
  return { ...current, completed, completedAt: completed ? updatedAt : null, updatedAt };
}
