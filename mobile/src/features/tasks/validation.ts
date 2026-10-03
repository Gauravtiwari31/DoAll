import { MAX_TAGS, TaskInput } from './types';

export type TaskFormErrors = Partial<
  Record<'title' | 'deadline' | 'tags', string>
>;

/** Mirrors the API's CreateTaskDto rules plus the deadline ≥ scheduled check. */
export function validateTask(input: TaskInput): TaskFormErrors {
  const errors: TaskFormErrors = {};
  const title = input.title.trim();
  if (!title) {
    errors.title = 'Give your task a title';
  } else if (title.length > 120) {
    errors.title = 'Keep the title under 120 characters';
  }
  if (
    input.deadline &&
    new Date(input.deadline) < new Date(input.scheduledAt)
  ) {
    errors.deadline = 'Deadline is before the scheduled time';
  }
  if (input.tags.length > MAX_TAGS) {
    errors.tags = `Up to ${MAX_TAGS} tags`;
  }
  return errors;
}

/** "#Work " → "work"; returns null for input that can't be a tag. */
export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-');
  return tag.length >= 1 && tag.length <= 20 ? tag : null;
}
