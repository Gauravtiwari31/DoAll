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
