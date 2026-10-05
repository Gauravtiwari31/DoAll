import { format } from 'date-fns';
import { occurrencesAfter } from '../tasks/recurrence';
import { Task } from '../tasks/types';

/** One notification for the native queue (see native/NativeReminders.ts). */
export interface PlannedReminder {
  id: string;
  taskId: string;
  title: string;
  body: string;
  /** When it goes off, in ms. */
  fireAt: number;
}

/** Choices offered in the editor, in minutes before the task. */
export const REMINDER_OFFSETS = [0, 10, 30, 60, 24 * 60] as const;

/** "At the time", "10 min before", "1 day before"... */
export function describeOffset(minutes: number): string {
  if (minutes === 0) {
    return 'At the time';
  }
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return `${days} day${days === 1 ? '' : 's'} before`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'} before`;
  }
  return `${minutes} min before`;
}

export interface PlanOptions {
  /** Reminders for a repeating task, at most. */
  perTask: number;
  /** Reminders in all, at most (the soonest win). */
  total: number;
  /** How far ahead to plan, in ms. */
  horizon: number;
}

/**
 * Generous, because Android only ever holds one alarm (for the next reminder)
 * and the queue is plain data: a daily task is covered for two months even if
 * the app isn't opened. Opening the app plans again from that moment.
 */
export const DEFAULT_PLAN: PlanOptions = {
  perTask: 64,
  total: 500,
  horizon: 62 * 24 * 60 * 60 * 1000,
};

function body(task: Task, occurrence: number): string {
  const time = format(occurrence, 'h:mmaaa');
  const offset = task.reminderOffset ?? 0;
  if (offset === 0) {
    return task.description.trim() || `Planned for ${time}`;
  }
  const when = describeOffset(offset).replace(' before', '');
  return `Coming up in ${when}, at ${time}`;
}

/**
 * Every reminder due after `now` for open tasks that have one: at the task's
 * scheduled time minus its reminder offset, for each upcoming occurrence of
 * a repeating task. Sorted by time.
 */
export function planReminders(
  tasks: Task[],
  now: number,
  options: PlanOptions = DEFAULT_PLAN,
): PlannedReminder[] {
  const until = now + options.horizon;
  const planned: PlannedReminder[] = [];
  for (const task of tasks) {
    if (task.completed || task.reminderOffset === null) {
      continue;
    }
    const lead = task.reminderOffset * 60 * 1000;
    const start = Date.parse(task.scheduledAt);
    const occurrences = task.recurrence
      ? occurrencesAfter(
          start,
          task.recurrence,
          task.timeZone,
          // The reminder must still be ahead, so the occurrence must be lead later.
          now + lead,
          options.perTask,
        )
      : start - lead > now
      ? [start]
      : [];
    for (const occurrence of occurrences) {
      const fireAt = occurrence - lead;
      if (fireAt > until) {
        break;
      }
      planned.push({
        id: `${task.id}@${occurrence}`,
        taskId: task.id,
        title: task.title,
        body: body(task, occurrence),
        fireAt,
      });
    }
  }
  return planned
    .sort((a, b) => a.fireAt - b.fireAt)
    .slice(0, options.total);
}
