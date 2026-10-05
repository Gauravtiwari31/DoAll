import type { RemoteTask } from '../api/syncApi';
import type { Recurrence, Task } from '../features/tasks/types';
import { Row, SqlDatabase, SqlExecutor, SqlValue } from './sql';

/** A task row with what sync needs to know about it. */
export interface StoredTask extends Task {
  deletedAt: string | null;
  /** Changed on the phone and not yet confirmed by the server. */
  dirty: boolean;
}

/** What applying a sync answer changed, for the in-memory list. */
export interface AppliedChanges {
  saved: Task[];
  removed: string[];
}

export type MetaKey = 'owner' | 'cursor' | 'lastSyncAt';

const iso = (ms: unknown) =>
  ms === null || ms === undefined ? null : new Date(Number(ms)).toISOString();
const ms = (value: string | null) => (value ? Date.parse(value) : null);

function toStored(row: Row): StoredTask {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ''),
    scheduledAt: iso(row.scheduled_at)!,
    deadline: iso(row.deadline),
    priority: row.priority as Task['priority'],
    category: row.category as Task['category'],
    tags: JSON.parse(String(row.tags ?? '[]')) as string[],
    completed: Number(row.completed) === 1,
    completedAt: iso(row.completed_at),
    reminderOffset:
      row.reminder_offset === null || row.reminder_offset === undefined
        ? null
        : Number(row.reminder_offset),
    recurrence: row.recurrence
      ? (JSON.parse(String(row.recurrence)) as Recurrence)
      : null,
    timeZone: String(row.time_zone),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
    deletedAt: iso(row.deleted_at),
    dirty: Number(row.dirty) === 1,
  };
}

/** Drops the sync-only fields. */
export function toTask({ deletedAt: _d, dirty: _x, ...task }: StoredTask): Task {
  return task;
}

const COLUMNS = [
  'id',
  'title',
  'description',
  'scheduled_at',
  'deadline',
  'priority',
  'category',
  'tags',
  'completed',
  'completed_at',
  'reminder_offset',
  'recurrence',
  'time_zone',
  'created_at',
  'updated_at',
  'deleted_at',
  'dirty',
];

const UPSERT = `INSERT INTO tasks (${COLUMNS.join(', ')})
  VALUES (${COLUMNS.map(() => '?').join(', ')})
  ON CONFLICT (id) DO UPDATE SET ${COLUMNS.slice(1)
    .map(c => `${c} = excluded.${c}`)
    .join(', ')}`;

function values(task: StoredTask): SqlValue[] {
  return [
    task.id,
    task.title,
    task.description,
    ms(task.scheduledAt),
    ms(task.deadline),
    task.priority,
    task.category,
    JSON.stringify(task.tags),
    task.completed ? 1 : 0,
    ms(task.completedAt),
    task.reminderOffset,
    task.recurrence ? JSON.stringify(task.recurrence) : null,
    task.timeZone,
    ms(task.createdAt),
    ms(task.updatedAt),
    ms(task.deletedAt),
    task.dirty ? 1 : 0,
  ];
}

/** Puts a task as the server sent it into the shape stored here. */
function fromRemote(remote: RemoteTask, fallbackZone: string): StoredTask {
  return {
    ...remote,
    // Tasks from older app versions have no zone: they were planned on a phone like this one.
    timeZone: remote.timeZone ?? fallbackZone,
    tags: remote.tags ?? [],
    reminderOffset: remote.reminderOffset ?? null,
    recurrence: remote.recurrence ?? null,
    dirty: false,
  };
}

/**
 * The phone's copy of the user's tasks, the app's source of truth. Changes
 * made here are marked dirty until the server confirms them; sync merges in
 * the server's changes, keeping whichever version of a task was changed last.
 */
export function createTaskStore(db: SqlDatabase, deviceZone: () => string) {
  const one = async (
    executor: SqlExecutor,
    id: string,
  ): Promise<StoredTask | null> => {
    const [row] = await executor.execute('SELECT * FROM tasks WHERE id = ?', [
      id,
    ]);
    return row ? toStored(row) : null;
  };

  const store = {
    /** Live tasks (not deleted), for the app. */
    async all(): Promise<Task[]> {
      const rows = await db.execute(
        'SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at',
      );
      return rows.map(row => toTask(toStored(row)));
    },

    get: (id: string) => one(db, id),

    /** Saves a change made on the phone; sync sends it later. */
    async save(task: Task): Promise<void> {
      await db.execute(UPSERT, values({ ...task, deletedAt: null, dirty: true }));
    },

    /** Deletes a task on the phone, keeping a tombstone until the server has it. */
    async remove(id: string, at: string): Promise<void> {
      await db.execute(
        'UPDATE tasks SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
        [ms(at), ms(at), id],
      );
    },

    /** Changes waiting to be sent, oldest first. */
    async pending(limit: number): Promise<StoredTask[]> {
      const rows = await db.execute(
        'SELECT * FROM tasks WHERE dirty = 1 ORDER BY updated_at LIMIT ?',
        [limit],
      );
      return rows.map(toStored);
    },

    async pendingCount(): Promise<number> {
      const [row] = await db.execute(
        'SELECT COUNT(*) AS n FROM tasks WHERE dirty = 1',
      );
      return Number(row?.n ?? 0);
    },

    /**
     * Merges tasks from the server: each replaces the phone's copy unless
     * that copy has a newer change still waiting to be sent.
     */
    async applyRemote(remote: RemoteTask[]): Promise<AppliedChanges> {
      const applied: AppliedChanges = { saved: [], removed: [] };
      if (remote.length === 0) {
        return applied;
      }
      const zone = deviceZone();
      await db.transaction(async tx => {
        for (const incoming of remote) {
          const local = await one(tx, incoming.id);
          if (
            local?.dirty &&
            Date.parse(local.updatedAt) > Date.parse(incoming.updatedAt)
          ) {
            continue; // ours is newer and goes up with the next push
          }
          if (incoming.deletedAt) {
            if (local) {
              await tx.execute('DELETE FROM tasks WHERE id = ?', [incoming.id]);
              if (!local.deletedAt) {
                applied.removed.push(incoming.id);
              }
            }
            continue;
          }
          const task = fromRemote(incoming, zone);
          await tx.execute(UPSERT, values(task));
          applied.saved.push(toTask(task));
        }
      });
      return applied;
    },

    /**
     * The server has these versions now: they're no longer dirty, and
     * tombstones can go. A task changed again since it was sent stays dirty.
     */
    async acknowledge(
      sent: Pick<StoredTask, 'id' | 'updatedAt'>[],
    ): Promise<void> {
      if (sent.length === 0) {
        return;
      }
      await db.transaction(async tx => {
        for (const { id, updatedAt } of sent) {
          await tx.execute(
            'UPDATE tasks SET dirty = 0 WHERE id = ? AND updated_at = ?',
            [id, ms(updatedAt)],
          );
        }
        await tx.execute(
          'DELETE FROM tasks WHERE deleted_at IS NOT NULL AND dirty = 0',
        );
      });
    },

    /**
     * Forgets every task the server already has (its full list follows),
     * keeping changes not yet sent. Returns the IDs of live tasks forgotten.
     */
    async dropSynced(): Promise<string[]> {
      return db.transaction(async tx => {
        const rows = await tx.execute(
          'SELECT id FROM tasks WHERE dirty = 0 AND deleted_at IS NULL',
        );
        await tx.execute('DELETE FROM tasks WHERE dirty = 0');
        return rows.map(row => String(row.id));
      });
    },

    async getMeta(key: MetaKey): Promise<string | null> {
      const [row] = await db.execute('SELECT value FROM meta WHERE key = ?', [
        key,
      ]);
      return row ? (row.value as string | null) : null;
    },

    async setMeta(key: MetaKey, value: string | null): Promise<void> {
      await db.execute(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
        [key, value],
      );
    },

    /** Empties the database: tasks and sync state. */
    async clear(): Promise<void> {
      await db.transaction(async tx => {
        await tx.execute('DELETE FROM tasks');
        await tx.execute('DELETE FROM meta');
      });
    },

    /**
     * Makes the database belong to this account. Another account's tasks
     * (someone else signed in on this phone) are removed first. Returns true
     * if it had to empty the database.
     */
    async claim(userId: string): Promise<boolean> {
      const owner = await store.getMeta('owner');
      if (owner === userId) {
        return false;
      }
      await store.clear();
      await store.setMeta('owner', userId);
      return owner !== null;
    },
  };
  return store;
}

export type TaskStore = ReturnType<typeof createTaskStore>;
