import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage';
import { runSync } from '../sync';
import { createTaskStore } from '../taskStore';
import { createTask, editTask, setCompleted, stamp } from '../taskOps';
import type { RemoteTask, SyncRequest, SyncResponse, Task, TaskInput } from '../types';

const input = (title: string): TaskInput => ({
  title,
  description: '',
  scheduledAt: '2026-10-09T09:00:00.000Z',
  deadline: null,
  priority: 'medium',
  category: 'personal',
  tags: [],
  reminderOffset: null,
  recurrence: null,
});

const newStore = () => createTaskStore(createMemoryStorage(), 'tasks', () => 'Asia/Kolkata');

const remote = (task: Task, deletedAt: string | null = null): RemoteTask => ({ ...task, deletedAt });

/**
 * The server's sync rules in miniature (backend/src/sync/sync.service.ts):
 * last write wins by updatedAt, and the cursor walks the server's own order.
 */
function fakeServer() {
  const rows = new Map<string, { task: RemoteTask; seq: number }>();
  let seq = 0;
  const send = async ({ cursor, changes }: SyncRequest): Promise<SyncResponse> => {
    const refused: RemoteTask[] = [];
    for (const change of changes) {
      const existing = rows.get(change.id);
      if (existing && Date.parse(existing.task.updatedAt) > Date.parse(change.updatedAt)) {
        refused.push(existing.task);
        continue;
      }
      rows.set(change.id, { task: change, seq: ++seq });
    }
    const since = Number(cursor ?? 0);
    const newer = [...rows.values()].filter(row => row.seq > since).map(row => row.task);
    return { changes: [...newer, ...refused], cursor: String(seq), hasMore: false, reset: false };
  };
  return { rows, send };
}

describe('task store', () => {
  it('keeps changes dirty until the server confirms them', () => {
    const store = newStore();
    const task = createTask(input('Buy milk'));
    store.save(task);
    expect(store.pendingCount()).toBe(1);

    store.acknowledge([{ id: task.id, updatedAt: task.updatedAt }]);
    expect(store.pendingCount()).toBe(0);
  });

  it('keeps a change made after the one that was sent', () => {
    const store = newStore();
    const task = createTask(input('Buy milk'));
    store.save(task);
    const edited = editTask(task, { title: 'Buy oat milk' });
    store.save(edited);

    store.acknowledge([{ id: task.id, updatedAt: task.updatedAt }]);
    expect(store.pending(10).map(t => t.title)).toEqual(['Buy oat milk']);
  });

  it("takes the server's version unless a newer one waits to be sent", () => {
    const store = newStore();
    const mine = createTask(input('Mine'));
    store.save(mine);

    const older = { ...mine, title: 'Older', updatedAt: new Date(Date.parse(mine.updatedAt) - 1000).toISOString() };
    store.applyRemote([remote(older)]);
    expect(store.get(mine.id)?.title).toBe('Mine');

    const newer = { ...mine, title: 'Newer', updatedAt: stamp(mine.updatedAt) };
    const applied = store.applyRemote([remote(newer)]);
    expect(applied.saved.map(t => t.title)).toEqual(['Newer']);
    expect(store.get(mine.id)).toMatchObject({ title: 'Newer', dirty: false });
  });

  it('removes tasks deleted elsewhere, and drops tombstones once sent', () => {
    const store = newStore();
    const task = createTask(input('Gone'));
    store.applyRemote([remote(task)]);
    const at = stamp(task.updatedAt);
    expect(store.applyRemote([remote({ ...task, updatedAt: at }, at)]).removed).toEqual([task.id]);
    expect(store.all()).toEqual([]);

    const local = createTask(input('Deleted here'));
    store.save(local);
    const deletedAt = stamp(local.updatedAt);
    store.remove(local.id, deletedAt);
    expect(store.all()).toEqual([]);
    expect(store.pending(10)[0]).toMatchObject({ id: local.id, deletedAt });
    store.acknowledge([{ id: local.id, updatedAt: deletedAt }]);
    expect(store.get(local.id)).toBeNull();
  });

  it("empties itself for a different account", () => {
    const store = newStore();
    expect(store.claim('ana')).toBe(false);
    store.save(createTask(input("Ana's")));
    expect(store.claim('ana')).toBe(false);
    expect(store.all()).toHaveLength(1);
    expect(store.claim('ben')).toBe(true);
    expect(store.all()).toEqual([]);
  });
});

describe('runSync', () => {
  it('brings two browsers to the same tasks', async () => {
    const server = fakeServer();
    const laptop = newStore();
    const phone = newStore();

    const shared = createTask(input('Pay rent'));
    laptop.save(shared);
    await runSync(laptop, server.send);
    await runSync(phone, server.send);
    expect(phone.all().map(t => t.title)).toEqual(['Pay rent']);

    // Both edit; the later edit wins on both.
    phone.save(editTask(phone.get(shared.id)!, { title: 'Pay rent (phone)' }));
    const later = editTask(laptop.get(shared.id)!, { title: 'Pay rent (laptop)' });
    laptop.save({ ...later, updatedAt: stamp(phone.get(shared.id)!.updatedAt) });
    await runSync(phone, server.send);
    await runSync(laptop, server.send);
    await runSync(phone, server.send);

    expect(laptop.all().map(t => t.title)).toEqual(['Pay rent (laptop)']);
    expect(phone.all().map(t => t.title)).toEqual(['Pay rent (laptop)']);
    expect(laptop.pendingCount() + phone.pendingCount()).toBe(0);
  });

  it('only downloads when asked not to push', async () => {
    const server = fakeServer();
    const store = newStore();
    store.save(createTask(input('Waiting for confirmation')));
    const result = await runSync(store, server.send, { push: false });
    expect(result.pushed).toBe(0);
    expect(server.rows.size).toBe(0);
    expect(store.pendingCount()).toBe(1);
  });

  it('starts over on reset, keeping unsent changes', async () => {
    const store = newStore();
    const synced = createTask(input('Synced long ago'));
    store.applyRemote([remote(synced)]);
    const unsent = createTask(input('Not sent yet'));
    store.save(unsent);

    await runSync(store, async () => ({ changes: [], cursor: '9', hasMore: false, reset: true }));
    expect(store.all().map(t => t.title)).toEqual(['Not sent yet']);
    expect(store.getMeta('cursor')).toBe('9');
  });

  it('sends large backlogs in batches', async () => {
    const server = fakeServer();
    const store = newStore();
    for (let i = 0; i < 450; i++) {
      store.save(createTask(input(`Task ${i}`)));
    }
    const result = await runSync(store, server.send);
    expect(result.pushed).toBe(450);
    expect(server.rows.size).toBe(450);
    expect(store.pendingCount()).toBe(0);
  });
});

describe('task changes', () => {
  it('stamps every change after the previous one', () => {
    const at = '2026-10-09T10:00:00.000Z';
    expect(stamp(at, Date.parse(at) - 60_000)).toBe('2026-10-09T10:00:00.001Z');
  });

  it('moves a repeating task to its next time instead of finishing it', () => {
    const task = {
      ...createTask(
        {
          ...input('Stand-up'),
          scheduledAt: '2026-10-09T03:30:00.000Z', // 09:00 in Kolkata
          deadline: '2026-10-09T04:30:00.000Z',
          recurrence: { freq: 'daily', interval: 1, byWeekday: [], byMonthDay: null },
        },
        'Asia/Kolkata',
      ),
    };
    const next = setCompleted(task, true, Date.parse('2026-10-09T05:00:00.000Z'));
    expect(next.completed).toBe(false);
    expect(next.scheduledAt).toBe('2026-10-10T03:30:00.000Z');
    expect(next.deadline).toBe('2026-10-10T04:30:00.000Z');
  });

  it('finishes and reopens a one-off task', () => {
    const task = createTask(input('One-off'));
    const done = setCompleted(task, true);
    expect(done).toMatchObject({ completed: true, completedAt: done.updatedAt });
    expect(setCompleted(done, false)).toMatchObject({ completed: false, completedAt: null });
  });

  it('follows the editing computer’s zone when the time changes', () => {
    const task = createTask(input('Call'), 'Asia/Kolkata');
    expect(editTask(task, { title: 'Call mum' }, 'Europe/Berlin').timeZone).toBe('Asia/Kolkata');
    expect(
      editTask(task, { scheduledAt: '2026-10-10T09:00:00.000Z' }, 'Europe/Berlin').timeZone,
    ).toBe('Europe/Berlin');
  });
});
