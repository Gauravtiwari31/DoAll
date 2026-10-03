import { Task, TaskInput } from '../features/tasks/types';
import { api } from './client';

export const tasksApi = {
  /** Every task of the signed-in user; filtering and sorting happen on device. */
  list: () =>
    api
      .get<Task[]>('/tasks', { params: { sort: 'created' } })
      .then(r => r.data),

  create: (input: TaskInput) =>
    api.post<Task>('/tasks', input).then(r => r.data),

  update: (id: string, changes: Partial<TaskInput>) =>
    api.patch<Task>(`/tasks/${id}`, changes).then(r => r.data),

  setCompleted: (id: string, completed: boolean) =>
    api.patch<Task>(`/tasks/${id}/status`, { completed }).then(r => r.data),

  remove: (id: string) => api.delete<void>(`/tasks/${id}`),

  clearCompleted: () =>
    api.delete<{ deleted: number }>('/tasks/completed').then(r => r.data),
};
