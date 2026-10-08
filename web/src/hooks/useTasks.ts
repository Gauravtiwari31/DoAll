import { deviceTimeZone } from '@app/utils/timezone';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, EMAIL_NOT_VERIFIED, NetworkError, session } from '../api';
import { storage, STORAGE_KEYS } from '../storage';
import { runSync } from '../sync';
import { stamp } from '../taskOps';
import { createTaskStore } from '../taskStore';
import type { Task, User } from '../types';

export const taskStore = createTaskStore(storage, STORAGE_KEYS.tasks, deviceTimeZone);

export type SyncState = 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  /** What went wrong, for offline and error. */
  message: string | null;
  lastSyncAt: string | null;
  /** Changes made here that the server doesn't have yet. */
  pending: number;
  /** The server is waiting for the email address to be confirmed before it stores changes. */
  unverified: boolean;
}

/** While the tab is open and visible. */
const SYNC_EVERY_MS = 60_000;
/** After a change, so a burst of edits goes up in one request. */
const SYNC_AFTER_CHANGE_MS = 1_500;

/**
 * The signed-in user's tasks: kept in this browser, synced with the server in
 * the background (on open, after changes, every minute, when the connection
 * comes back) and with other tabs of this browser.
 */
export function useTasks(user: User) {
  const [tasks, setTasks] = useState<Task[]>(() => {
    taskStore.claim(user.id);
    return taskStore.all();
  });
  const [status, setStatus] = useState<SyncStatus>(() => ({
    state: 'syncing',
    message: null,
    lastSyncAt: taskStore.getMeta('lastSyncAt'),
    pending: taskStore.pendingCount(),
    unverified: false,
  }));

  const running = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reload = useCallback(() => {
    setTasks(taskStore.all());
    setStatus(current => ({ ...current, pending: taskStore.pendingCount() }));
  }, []);

  const sync = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus(current => ({ ...current, state: 'syncing' }));
    let outcome: Partial<SyncStatus> = {};
    try {
      let unverified = false;
      try {
        await runSync(taskStore, api.sync);
      } catch (error) {
        if (!(error instanceof ApiError && error.code === EMAIL_NOT_VERIFIED)) {
          throw error;
        }
        // Download only until the address is confirmed; the changes wait here.
        unverified = true;
        await runSync(taskStore, api.sync, { push: false });
      }
      outcome = { state: 'synced', message: null, unverified };
      if (!unverified && !session.get()?.user.emailVerified) {
        // Confirmed since signing in: refresh the profile.
        api.me().then(session.updateUser, () => undefined);
      }
    } catch (error) {
      outcome =
        error instanceof NetworkError
          ? { state: 'offline', message: error.message }
          : { state: 'error', message: (error as Error).message };
    } finally {
      running.current = false;
      setTasks(taskStore.all());
      setStatus(current => ({
        ...current,
        ...outcome,
        lastSyncAt: taskStore.getMeta('lastSyncAt'),
        pending: taskStore.pendingCount(),
      }));
      if (again.current) {
        again.current = false;
        void sync();
      }
    }
  }, []);

  const changed = useCallback(() => {
    reload();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void sync(), SYNC_AFTER_CHANGE_MS);
  }, [reload, sync]);

  useEffect(() => {
    void sync();
    const visible = () => document.visibilityState === 'visible';
    const every = setInterval(() => {
      if (visible() && navigator.onLine) {
        void sync();
      }
    }, SYNC_EVERY_MS);
    const onFocus = () => visible() && void sync();
    const onOnline = () => void sync();
    // Another tab of this browser changed the tasks.
    const onStorage = (event: StorageEvent) => event.key === STORAGE_KEYS.tasks && reload();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(every);
      clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('storage', onStorage);
    };
  }, [reload, sync]);

  const save = useCallback(
    (task: Task) => {
      taskStore.save(task);
      changed();
    },
    [changed],
  );

  const remove = useCallback(
    (id: string) => {
      taskStore.remove(id, stamp(taskStore.get(id)?.updatedAt));
      changed();
    },
    [changed],
  );

  /** Brings a just-deleted task back (Undo): a newer version than its deletion. */
  const restore = useCallback(
    (task: Task) => {
      taskStore.save({ ...task, updatedAt: stamp(taskStore.get(task.id)?.updatedAt) });
      changed();
    },
    [changed],
  );

  return { tasks, status, save, remove, restore, syncNow: sync };
}
