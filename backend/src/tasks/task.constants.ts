export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_CATEGORIES = [
  'personal',
  'work',
  'study',
  'health',
  'shopping',
  'other',
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/** `smart` blends priority, deadline pressure and schedule (see task-ordering.ts). */
export const TASK_SORTS = ['smart', 'deadline', 'scheduled', 'priority', 'created'] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

export const TASK_STATUSES = ['all', 'active', 'completed', 'overdue'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const MAX_TAGS = 5;

export const RECURRENCE_FREQUENCIES = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

/** Reminders can be set up to a week before the task. */
export const MAX_REMINDER_OFFSET_MINUTES = 7 * 24 * 60;

/**
 * Deleted tasks are kept as tombstones this long so every device hears about
 * the deletion. A device that hasn't synced for longer starts over (sync
 * `reset`), because it may have missed deletions.
 */
export const TOMBSTONE_RETENTION_DAYS = 60;

/**
 * What a deleted task keeps until its tombstone expires: none of what the
 * user wrote, only its ID and dates (enough for sync).
 */
export const TOMBSTONE_CONTENT = {
  title: 'Deleted task',
  description: '',
  tags: [] as string[],
  reminderOffset: null,
  recurrence: null,
} as const;
