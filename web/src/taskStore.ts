import type { KeyValueStorage } from './storage';
import type { RemoteTask, Task } from './types';

/** A task with what sync needs to know about it. */
export interface StoredTask extends Task {
  deletedAt: string | null;
  /** Changed in this browser and not yet confirmed by the server. */
  dirty: boolean;
}

export interface AppliedChanges {
  saved: Task[];
  removed: string[];
}

export type MetaKey = 'owner' | 'cursor' | 'lastSyncAt';

interface Snapshot {
  meta: Partial<Record<MetaKey, string | null>>;
  tasks: Record<string, StoredTask>;
}

const time = (iso: string) => Date.parse(iso);

export const toTask = ({ deletedAt: _deleted, dirty: _dirty, ...task }: StoredTask): Task => task;

function fromRemote(remote: RemoteTask, fallbackZone: string): StoredTask {
  return {
    ...remote,
    // Tasks from older app versions have no zone: they were planned somewhere like here.
    timeZone: remote.timeZone ?? fallbackZone,
    tags: remote.tags ?? [],
    reminderOffset: remote.reminderOffset ?? null,
    recurrence: remote.recurrence ?? null,
    dirty: false,
  };
}

/**
 * This browser's copy of the user's tasks, kept in localStorage. The same
 * rules as the phone's SQLite store (mobile/src/db/taskStore.ts): changes made
 * here stay dirty until the server confirms them, and sync keeps whichever
 * version of a task was changed last.
 *
 * Every call reads and writes the whole snapshot synchronously, so tabs never
 * see half a change; another tab's changes are picked up on the next call.
 */
export function createTaskStore(storage: KeyValueStorage, key: string, deviceZone: () => string) {
  const read = (): Snapshot => {
    try {
      const parsed = JSON.parse(storage.get(key) ?? '') as Snapshot;
      if (parsed && typeof parsed.tasks === 'object' && typeof parsed.meta === 'object') {
        return parsed;
      }
    } catch {
      // Nothing stored yet, or unreadable: start empty.
    }
    return { meta: {}, tasks: {} };
  };
  const write = (snapshot: Snapshot) => storage.set(key, JSON.stringify(snapshot));
  const update = <T>(change: (snapshot: Snapshot) => T): T => {
    const snapshot = read();
    const result = change(snapshot);
    write(snapshot);
    return result;
  };

  const store = {
    /** Live tasks (not deleted). */
    all(): Task[] {
      return Object.values(read().tasks)
        .filter(task => !task.deletedAt)
        .sort((a, b) => time(a.createdAt) - time(b.createdAt))
        .map(toTask);
    },

    get(id: string): StoredTask | null {
      return read().tasks[id] ?? null;
    },

    /** Saves a change made here; sync sends it later. */
    save(task: Task) {
      update(snapshot => {
        snapshot.tasks[task.id] = { ...task, deletedAt: null, dirty: true };
      });
    },

    /** Deletes a task here, keeping a tombstone until the server has it. */
    remove(id: string, at: string) {
      update(snapshot => {
        const task = snapshot.tasks[id];
        if (task) {
          snapshot.tasks[id] = { ...task, deletedAt: at, updatedAt: at, dirty: true };
        }
      });
    },

    /** Changes waiting to be sent, oldest first. */
    pending(limit: number): StoredTask[] {
      return Object.values(read().tasks)
        .filter(task => task.dirty)
        .sort((a, b) => time(a.updatedAt) - time(b.updatedAt))
        .slice(0, limit);
    },

    pendingCount(): number {
      return Object.values(read().tasks).filter(task => task.dirty).length;
    },

    /**
     * Merges tasks from the server: each replaces the copy here unless that
     * copy has a newer change still waiting to be sent.
     */
    applyRemote(remote: RemoteTask[]): AppliedChanges {
      const applied: AppliedChanges = { saved: [], removed: [] };
      if (remote.length === 0) {
        return applied;
      }
      const zone = deviceZone();
      update(snapshot => {
        for (const incoming of remote) {
          const local = snapshot.tasks[incoming.id];
          if (local?.dirty && time(local.updatedAt) > time(incoming.updatedAt)) {
            continue; // ours is newer and goes up with the next push
          }
          if (incoming.deletedAt) {
            if (local) {
              delete snapshot.tasks[incoming.id];
              if (!local.deletedAt) {
                applied.removed.push(incoming.id);
              }
            }
            continue;
          }
          const task = fromRemote(incoming, zone);
          snapshot.tasks[task.id] = task;
          applied.saved.push(toTask(task));
        }
      });
      return applied;
    },

    /**
     * The server has these versions now: they're no longer dirty, and
     * tombstones can go. A task changed again since it was sent stays dirty.
     */
    acknowledge(sent: Pick<StoredTask, 'id' | 'updatedAt'>[]) {
      if (sent.length === 0) {
        return;
      }
      update(snapshot => {
        for (const { id, updatedAt } of sent) {
          const task = snapshot.tasks[id];
          if (task && task.updatedAt === updatedAt) {
            task.dirty = false;
          }
        }
        for (const [id, task] of Object.entries(snapshot.tasks)) {
          if (task.deletedAt && !task.dirty) {
            delete snapshot.tasks[id];
          }
        }
      });
    },

    /**
     * Forgets every task the server already has (its full list follows),
     * keeping changes not yet sent. Returns the IDs of live tasks forgotten.
     */
    dropSynced(): string[] {
      return update(snapshot => {
        const dropped: string[] = [];
        for (const [id, task] of Object.entries(snapshot.tasks)) {
          if (!task.dirty) {
            if (!task.deletedAt) {
              dropped.push(id);
            }
            delete snapshot.tasks[id];
          }
        }
        return dropped;
      });
    },

    getMeta(name: MetaKey): string | null {
      return read().meta[name] ?? null;
    },

    setMeta(name: MetaKey, value: string | null) {
      update(snapshot => {
        snapshot.meta[name] = value;
      });
    },

    clear() {
      storage.remove(key);
    },

    /**
     * Makes the stored tasks belong to this account; another account's tasks
     * (someone else signed in on this browser) are removed first. Returns true
     * if it had to empty the store.
     */
    claim(userId: string): boolean {
      const owner = store.getMeta('owner');
      if (owner === userId) {
        return false;
      }
      store.clear();
      store.setMeta('owner', userId);
      return owner !== null;
    },
  };
  return store;
}

export type TaskStore = ReturnType<typeof createTaskStore>;
