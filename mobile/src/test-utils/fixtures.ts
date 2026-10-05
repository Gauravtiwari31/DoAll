import { Task } from '../features/tasks/types';

let seq = 0;

/** Builds a task with sensible defaults; override only what a test cares about. */
export function makeTask(overrides: Partial<Task> = {}): Task {
  seq += 1;
  const now = new Date().toISOString();
  return {
    id: `task-${seq}`,
    title: `Task ${seq}`,
    description: '',
    scheduledAt: now,
    deadline: null,
    priority: 'medium',
    category: 'personal',
    tags: [],
    completed: false,
    completedAt: null,
    reminderOffset: null,
    recurrence: null,
    timeZone: 'Asia/Kolkata',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
