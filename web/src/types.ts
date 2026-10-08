import type { Task } from '@app/features/tasks/types';

export type { Category, Priority, Recurrence, SortKey, Task, TaskInput, TaskView } from '@app/features/tasks/types';

/** A task as POST /sync sends and returns it (see mobile/src/api/syncApi.ts). */
export interface RemoteTask extends Omit<Task, 'timeZone'> {
  timeZone: string | null;
  deletedAt: string | null;
}

export interface SyncRequest {
  cursor: string | null;
  changes: RemoteTask[];
}

export interface SyncResponse {
  changes: RemoteTask[];
  cursor: string;
  hasMore: boolean;
  /** This browser was away too long and may have missed deletions: start over. */
  reset: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  signInMethods: ('password' | 'google')[];
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}
