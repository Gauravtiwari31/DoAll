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

/** A task as returned by the API (dates are ISO strings so Redux state stays serialisable). */
export interface Task {
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
  createdAt: string;
  updatedAt: string;
}

/** Payload for creating / editing a task. */
export interface TaskInput {
  title: string;
  description: string;
  scheduledAt: string;
  deadline: string | null;
  priority: Priority;
  category: Category;
  tags: string[];
}

export interface TaskFilters {
  view: TaskView;
  priority: Priority | null;
  category: Category | null;
  search: string;
}
