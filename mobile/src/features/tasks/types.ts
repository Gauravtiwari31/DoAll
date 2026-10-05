import type { Recurrence } from './recurrence';

export type { Recurrence } from './recurrence';

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = [
  'personal',
  'work',
  'study',
  'health',
  'shopping',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SORTS = [
  'smart',
  'deadline',
  'scheduled',
  'priority',
  'created',
] as const;
export type SortKey = (typeof SORTS)[number];

/** Quick views shown as tabs on the home screen. */
export const VIEWS = ['all', 'today', 'upcoming', 'overdue', 'done'] as const;
export type TaskView = (typeof VIEWS)[number];

export const MAX_TAGS = 5;

/**
 * A task as stored on the phone and synced with the server. Dates are ISO
 * strings so Redux state stays serialisable.
 */
export interface Task {
  /** A UUID made on the phone, so tasks can be created offline. */
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  deadline: string | null;
  priority: Priority;
  category: Category;
  tags: string[];
  completed: boolean;
  completedAt: string | null;
  /** Remind this many minutes before scheduledAt (0 = at that time); null = no reminder. */
  reminderOffset: number | null;
  /** How the task repeats; null for a one-off task. */
  recurrence: Recurrence | null;
  /** IANA time zone the task was planned in; repeats keep its local time. */
  timeZone: string;
  createdAt: string;
  /** Last change, by this phone's clock. Sync keeps the latest version. */
  updatedAt: string;
}

/** What the task editor sets. */
export interface TaskInput {
  title: string;
  description: string;
  scheduledAt: string;
  deadline: string | null;
  priority: Priority;
  category: Category;
  tags: string[];
  reminderOffset: number | null;
  recurrence: Recurrence | null;
}

export interface TaskFilters {
  view: TaskView;
  priority: Priority | null;
  category: Category | null;
  search: string;
}
