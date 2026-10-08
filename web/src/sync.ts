import type { StoredTask, TaskStore } from './taskStore';
import type { RemoteTask, SyncRequest, SyncResponse } from './types';

/** Most changes sent per request (the server's limit). */
export const PUSH_BATCH = 200;
/** A safety stop; real syncs need a handful of rounds at most. */
const MAX_ROUNDS = 100;

export interface SyncResult {
  /** Changes sent from this browser. */
  pushed: number;
  /** Tasks the server's side added, changed or deleted. */
  pulled: number;
}

const toRemote = ({ dirty: _dirty, ...task }: StoredTask): RemoteTask => task;

/**
 * One full sync, the same protocol as the app (mobile/src/sync/engine.ts):
 * sends this browser's changes in batches and merges in the server's, round
 * after round until neither side has more. Safe to interrupt at any point:
 * whatever wasn't confirmed is simply sent again next time. With
 * `push: false` it only downloads (the server won't store changes before the
 * email address is confirmed).
 */
export async function runSync(
  store: TaskStore,
  send: (request: SyncRequest) => Promise<SyncResponse>,
  { push = true }: { push?: boolean } = {},
): Promise<SyncResult> {
  let pushed = 0;
  let pulled = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const cursor = store.getMeta('cursor');
    const pending = push ? store.pending(PUSH_BATCH) : [];
    const response = await send({ cursor, changes: pending.map(toRemote) });

    if (response.reset) {
      pulled += store.dropSynced().length;
    }
    const applied = store.applyRemote(response.changes);
    pulled += applied.saved.length + applied.removed.length;

    store.acknowledge(pending);
    store.setMeta('cursor', response.cursor);
    pushed += pending.length;

    if (!response.hasMore && pending.length < PUSH_BATCH) {
      break;
    }
  }

  store.setMeta('lastSyncAt', new Date().toISOString());
  return { pushed, pulled };
}
