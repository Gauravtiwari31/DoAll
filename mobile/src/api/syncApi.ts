import type { Task } from '../features/tasks/types';
import { api } from './client';

/** A task as POST /sync sends and returns it: the app's task plus its deletion time. */
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
  /** The phone was away too long and may have missed deletions: start over. */
  reset: boolean;
}

export const syncApi = {
  sync: (body: SyncRequest) =>
    api.post<SyncResponse>('/sync', body).then(r => r.data),
};
