import { device } from '../services/device';
import { getDatabase } from './database';
import { createTaskStore, TaskStore } from './taskStore';

let store: Promise<TaskStore> | null = null;

/** The phone's task database (see taskStore.ts), opened on first use. */
export function getTaskStore(): Promise<TaskStore> {
  if (!store) {
    store = getDatabase().then(db => createTaskStore(db, device.timeZone));
    store.catch(() => {
      store = null;
    });
  }
  return store;
}

export type { AppliedChanges, StoredTask, TaskStore } from './taskStore';
