import { Types } from 'mongoose';
import { Recurrence, Task } from './schemas/task.schema';
import { TaskCategory, TaskPriority } from './task.constants';

/** Shape of a task in API responses. */
export interface TaskResponse {
  id: string;
  title: string;
  description: string;
  scheduledAt: Date;
  deadline: Date | null;
  priority: TaskPriority;
  category: TaskCategory;
  tags: string[];
  completed: boolean;
  completedAt: Date | null;
  reminderOffset: number | null;
  recurrence: Recurrence | null;
  timeZone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LeanTask = Task & { _id: Types.ObjectId };

export const toTaskResponse = (task: LeanTask): TaskResponse => ({
  id: task._id.toString(),
  title: task.title,
  description: task.description ?? '',
  scheduledAt: task.scheduledAt,
  deadline: task.deadline ?? null,
  priority: task.priority,
  category: task.category,
  tags: task.tags ?? [],
  completed: task.completed,
  completedAt: task.completedAt ?? null,
  reminderOffset: task.reminderOffset ?? null,
  recurrence: task.recurrence ?? null,
  timeZone: task.timeZone ?? null,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});
