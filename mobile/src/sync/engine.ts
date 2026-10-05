import type { RemoteTask, SyncRequest, SyncResponse } from '../api/syncApi';
import type { StoredTask, TaskStore } from '../db/taskStore';
import type { Task } from '../features/tasks/types';

/** Most changes sent per request (the server's limit). */
export const PUSH_BATCH = 200;
/** A safety stop; real syncs need a handful of rounds at most. */
const MAX_ROUNDS = 100;

export interface SyncResult {
  /** Tasks added or changed by the server's side. */
  saved: Task[];
  /** Tasks deleted on the server's side. */
  removed: string[];
  /** Changes sent from this phone. */
  pushed: number;
}

const toRemote = ({ dirty: _dirty, ...task }: StoredTask): RemoteTask => task;

/**
 * One full sync: sends the phone's changes in batches and merges in the
 * server's, round after round until neither side has more (see the server's
 * SyncService for the rules). Safe to interrupt at any point: whatever
 * wasn't confirmed is simply sent again next time. With `push: false` it
 * only downloads (the server won't store changes before the email address
 * is confirmed).
 */
export async function runSync(
  store: TaskStore,
  send: (request: SyncRequest) => Promise<SyncResponse>,
  { push = true }: { push?: boolean } = {},
): Promise<SyncResult> {
  const saved = new Map<string, Task>();
  const removed = new Set<string>();
  const forget = (id: string) => {
    saved.delete(id);
    removed.add(id);
  };
  let pushed = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const cursor = await store.getMeta('cursor');
    // Pull only: send nothing, so nothing is marked as sent either.
    const pending = push ? await store.pending(PUSH_BATCH) : [];
    const response = await send({ cursor, changes: pending.map(toRemote) });

    if (response.reset) {
      (await store.dropSynced()).forEach(forget);
    }
    const applied = await store.applyRemote(response.changes);
    for (const task of applied.saved) {
      removed.delete(task.id);
      saved.set(task.id, task);
    }
    applied.removed.forEach(forget);

    await store.acknowledge(pending);
    await store.setMeta('cursor', response.cursor);
    pushed += pending.length;

    if (!response.hasMore && pending.length < PUSH_BATCH) {
      break;
    }
  }

  await store.setMeta('lastSyncAt', new Date().toISOString());
  return { saved: [...saved.values()], removed: [...removed], pushed };
}
