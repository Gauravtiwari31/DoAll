import type {
  RemoteTask,
  SyncRequest,
  SyncResponse,
} from '../../api/syncApi';
import { createTaskStore, TaskStore } from '../../db/taskStore';
import { Task } from '../../features/tasks/types';
import { makeTask } from '../../test-utils/fixtures';
import { createTestDatabase } from '../../test-utils/sqlite';
import { PUSH_BATCH, runSync } from '../engine';

/**
 * A stand-in for POST /sync with the server's rules: last write wins by
 * updatedAt, pulls follow the server's own clock, refused changes come back,
 * deletions are tombstones that a phone starting from scratch doesn't get.
 */
class FakeServer {
  private tasks = new Map<string, RemoteTask & { serverAt: number }>();
  private clock = 0;
  pageSize = 500;
  requests: SyncRequest[] = [];
  /** Answer the next request with `reset: true`. */
  resetNext = false;

  sync = async (request: SyncRequest): Promise<SyncResponse> => {
    this.requests.push(request);
    const refused: string[] = [];
    for (const change of request.changes) {
      const stored = this.tasks.get(change.id);
      if (!stored || Date.parse(stored.updatedAt) < Date.parse(change.updatedAt)) {
        this.tasks.set(change.id, { ...change, serverAt: ++this.clock });
      } else {
        refused.push(change.id);
      }
    }
    const reset = this.resetNext;
    this.resetNext = false;
    const from = request.cursor && !reset ? Number(request.cursor) : 0;
    const pulled = [...this.tasks.values()]
      .filter(t => t.serverAt > from && (from > 0 || !t.deletedAt))
      .sort((a, b) => a.serverAt - b.serverAt)
      .slice(0, this.pageSize);
    const ids = new Set(pulled.map(t => t.id));
    const winners = refused
      .filter(id => !ids.has(id))
      .map(id => this.tasks.get(id)!);
    const strip = ({ serverAt: _s, ...task }: RemoteTask & { serverAt: number }) => task;
    return {
      changes: [...pulled, ...winners].map(strip),
      cursor: String(pulled.at(-1)?.serverAt ?? from),
      hasMore: pulled.length === this.pageSize,
      reset,
    };
  };

  get(id: string) {
    return this.tasks.get(id);
  }
}

const phone = async (): Promise<TaskStore> =>
  createTaskStore(await createTestDatabase(), () => 'Asia/Kolkata');

const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 6, 9, minute)).toISOString();

const titles = async (store: TaskStore) =>
  (await store.all()).map(t => t.title).sort();

describe('sync', () => {
  let server: FakeServer;
  let a: TaskStore;
  let b: TaskStore;

  beforeEach(async () => {
    server = new FakeServer();
    a = await phone();
    b = await phone();
  });

  it('carries tasks made offline on one phone to another', async () => {
    const task = makeTask({ title: 'Buy milk', updatedAt: at(0) });
    await a.save(task);
    expect(await a.pendingCount()).toBe(1);

    const pushed = await runSync(a, server.sync);
    expect(pushed.pushed).toBe(1);
    expect(await a.pendingCount()).toBe(0);

    const pulled = await runSync(b, server.sync);
    expect(pulled.saved).toEqual([task]);
    expect(await b.all()).toEqual([task]);
    expect(await b.pendingCount()).toBe(0);
  });

  it('keeps the latest edit when two phones change the same task', async () => {
    const task = makeTask({ title: 'v0', updatedAt: at(0) });
    await a.save(task);
    await runSync(a, server.sync);
    await runSync(b, server.sync);

    await a.save({ ...task, title: 'from A', updatedAt: at(5) });
    await b.save({ ...task, title: 'from B', updatedAt: at(3) });

    await runSync(a, server.sync);
    // B's edit is older: refused, and B takes A's version.
    const result = await runSync(b, server.sync);
    expect(result.saved.map(t => t.title)).toEqual(['from A']);
    expect(await titles(b)).toEqual(['from A']);
    expect(await b.pendingCount()).toBe(0);
    expect(server.get(task.id)?.title).toBe('from A');
  });

  it("doesn't let an older server version overwrite a newer edit waiting to be sent", async () => {
    const task = makeTask({ title: 'v0', updatedAt: at(0) });
    await a.save(task);
    await runSync(a, server.sync);
    await runSync(b, server.sync);

    await a.save({ ...task, title: 'A', updatedAt: at(2) });
    await runSync(a, server.sync);
    await b.save({ ...task, title: 'B, later', updatedAt: at(9) });

    // B pulls A's older edit while its own newer one is still dirty: B's wins.
    const applied = await b.applyRemote([
      { ...task, title: 'A', updatedAt: at(2), deletedAt: null },
    ]);
    expect(applied.saved).toEqual([]);
    await runSync(b, server.sync);
    await runSync(a, server.sync);
    expect(await titles(a)).toEqual(['B, later']);
  });

  it('spreads deletions, then forgets the tombstones', async () => {
    const task = makeTask({ title: 'Doomed', updatedAt: at(0) });
    await a.save(task);
    await runSync(a, server.sync);
    await runSync(b, server.sync);

    await a.remove(task.id, at(4));
    expect(await a.all()).toEqual([]);
    expect((await a.get(task.id))?.deletedAt).toBe(at(4));

    await runSync(a, server.sync);
    expect(await a.get(task.id)).toBeNull(); // tombstone confirmed and dropped
    const result = await runSync(b, server.sync);
    expect(result.removed).toEqual([task.id]);
    expect(await b.all()).toEqual([]);

    // A phone starting from scratch never hears of it.
    const c = await phone();
    expect((await runSync(c, server.sync)).saved).toEqual([]);
  });

  it('brings a deleted task back when it is restored later', async () => {
    const task = makeTask({ title: 'Undo me', updatedAt: at(0) });
    await a.save(task);
    await a.remove(task.id, at(1));
    await runSync(a, server.sync);
    await a.save({ ...task, updatedAt: at(2) });
    await runSync(a, server.sync);
    expect(server.get(task.id)?.deletedAt).toBeNull();
    expect(await titles(a)).toEqual(['Undo me']);
  });

  it('keeps an edit made while a sync was running dirty', async () => {
    const task = makeTask({ title: 'v1', updatedAt: at(0) });
    await a.save(task);
    await runSync(a, async request => {
      // The user edits the task while the request is on its way.
      await a.save({ ...task, title: 'v2', updatedAt: at(1) });
      return server.sync(request);
    });
    expect(await a.pendingCount()).toBe(1);
    await runSync(a, server.sync);
    expect(server.get(task.id)?.title).toBe('v2');
    expect(await a.pendingCount()).toBe(0);
  });

  it('can only download, keeping its own changes for later', async () => {
    await a.save(makeTask({ title: 'On server', updatedAt: at(0) }));
    await runSync(a, server.sync);
    await b.save(makeTask({ title: 'Waiting', updatedAt: at(1) }));

    const result = await runSync(b, server.sync, { push: false });
    expect(result.pushed).toBe(0);
    expect(server.requests.at(-1)?.changes).toEqual([]);
    expect(await titles(b)).toEqual(['On server', 'Waiting']);
    expect(await b.pendingCount()).toBe(1);
  });

  it('loses nothing when the connection drops mid-sync', async () => {
    await a.save(makeTask({ title: 'Offline', updatedAt: at(0) }));
    await expect(
      runSync(a, () => Promise.reject(new Error('Network Error'))),
    ).rejects.toThrow('Network Error');
    expect(await a.pendingCount()).toBe(1);
    await runSync(a, server.sync);
    expect(await a.pendingCount()).toBe(0);
  });

  it('sends large backlogs in batches and pulls large ones in pages', async () => {
    const tasks: Task[] = Array.from({ length: PUSH_BATCH * 2 + 50 }, (_, i) =>
      makeTask({ title: `T${i}`, updatedAt: at(i % 60) }),
    );
    for (const task of tasks) {
      await a.save(task);
    }
    await runSync(a, server.sync);
    expect(server.requests.map(r => r.changes.length)).toEqual([
      PUSH_BATCH,
      PUSH_BATCH,
      50,
    ]);

    server.pageSize = 200;
    const result = await runSync(b, server.sync);
    expect(result.saved).toHaveLength(tasks.length);
    expect(await b.all()).toHaveLength(tasks.length);
  });

  it('starts over when the server says it was away too long, keeping unsent changes', async () => {
    const kept = makeTask({ title: 'On server', updatedAt: at(0) });
    const gone = makeTask({ title: 'Deleted elsewhere long ago', updatedAt: at(0) });
    await b.applyRemote([
      { ...kept, deletedAt: null },
      { ...gone, deletedAt: null },
    ]);
    await b.setMeta('cursor', '1');
    await a.save(kept);
    await runSync(a, server.sync);

    const unsent = makeTask({ title: 'Not sent yet', updatedAt: at(1) });
    await b.save(unsent);
    server.resetNext = true;
    const result = await runSync(b, server.sync);

    expect(result.removed).toEqual([gone.id]);
    expect(await titles(b)).toEqual(['Not sent yet', 'On server']);
    expect(server.get(unsent.id)).toBeDefined();
  });
});

describe('task store', () => {
  it('belongs to one account at a time', async () => {
    const store = await phone();
    expect(await store.claim('u1')).toBe(false); // empty: nothing to remove
    await store.save(makeTask({ title: "u1's task" }));
    expect(await store.claim('u1')).toBe(false);
    expect(await store.all()).toHaveLength(1);

    expect(await store.claim('u2')).toBe(true);
    expect(await store.all()).toEqual([]);
    expect(await store.getMeta('owner')).toBe('u2');
  });

  it('round-trips every field', async () => {
    const store = await phone();
    const task = makeTask({
      title: 'Gym',
      description: 'Legs',
      deadline: at(30),
      tags: ['health'],
      completed: true,
      completedAt: at(20),
      reminderOffset: 10,
      recurrence: { freq: 'weekly', interval: 2, byWeekday: [1, 3], byMonthDay: null },
      timeZone: 'Europe/Berlin',
    });
    await store.save(task);
    expect(await store.all()).toEqual([task]);
  });

  it('gives tasks from older app versions, which have no zone, the phone\'s zone', async () => {
    const store = await phone();
    const task = makeTask();
    await store.applyRemote([{ ...task, timeZone: null, deletedAt: null }]);
    expect((await store.all())[0].timeZone).toBe('Asia/Kolkata');
  });
});
