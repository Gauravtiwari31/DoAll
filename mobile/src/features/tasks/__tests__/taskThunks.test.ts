import { configureStore } from '@reduxjs/toolkit';
import { getTaskStore } from '../../../db';
import authReducer, { restoreSession } from '../../auth/authSlice';
import preferencesReducer from '../../preferences/preferencesSlice';
import syncReducer from '../../sync/syncSlice';
import tasksReducer, {
  clearCompleted,
  createTask,
  deleteTask,
  fetchTasks,
  restoreTask,
  setTaskCompleted,
  updateTask,
} from '../tasksSlice';
import { TaskInput } from '../types';

const user = {
  id: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const input = (overrides: Partial<TaskInput> = {}): TaskInput => ({
  title: 'Water plants',
  description: '',
  scheduledAt: '2030-01-31T03:30:00.000Z', // 9:00 in Kolkata
  deadline: '2030-01-31T05:30:00.000Z',
  priority: 'medium',
  category: 'personal',
  tags: [],
  reminderOffset: 10,
  recurrence: null,
  ...overrides,
});

/** The app's reducers, signed in as `user`, without the side-effect listeners. */
async function signedInStore() {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      tasks: tasksReducer,
      sync: syncReducer,
      preferences: preferencesReducer,
    },
  });
  store.dispatch({ type: restoreSession.fulfilled.type, payload: user });
  await store.dispatch(fetchTasks());
  return store;
}

describe('task changes', () => {
  beforeEach(async () => {
    await (await getTaskStore()).clear();
  });

  it('saves new tasks on the phone, with an ID and time zone of their own', async () => {
    const store = await signedInStore();
    const task = await store.dispatch(createTask(input())).unwrap();

    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(task.timeZone).toBe('Asia/Kolkata');
    expect(store.getState().tasks.entities[task.id]).toEqual(task);
    const db = await getTaskStore();
    expect(await db.all()).toEqual([task]);
    expect(await db.pendingCount()).toBe(1);
  });

  it('moves a repeating task to its next occurrence instead of finishing it', async () => {
    const store = await signedInStore();
    const task = await store
      .dispatch(
        createTask(
          input({
            recurrence: { freq: 'monthly', interval: 1, byWeekday: [], byMonthDay: 31 },
          }),
        ),
      )
      .unwrap();

    const next = await store
      .dispatch(setTaskCompleted({ task, completed: true }))
      .unwrap();
    expect(next.completed).toBe(false);
    expect(next.scheduledAt).toBe('2030-02-28T03:30:00.000Z'); // the last day of February
    expect(next.deadline).toBe('2030-02-28T05:30:00.000Z'); // moved along with it
    expect(Date.parse(next.updatedAt)).toBeGreaterThan(Date.parse(task.updatedAt));

    const after = await store
      .dispatch(setTaskCompleted({ task: next, completed: true }))
      .unwrap();
    expect(after.scheduledAt).toBe('2030-03-31T03:30:00.000Z'); // back to the 31st
  });

  it('finishes one-off tasks', async () => {
    const store = await signedInStore();
    const task = await store.dispatch(createTask(input())).unwrap();
    const done = await store
      .dispatch(setTaskCompleted({ task, completed: true }))
      .unwrap();
    expect(done.completed).toBe(true);
    expect(done.completedAt).toBe(done.updatedAt);
  });

  it('takes the phone\'s zone when a task is rescheduled, not when it is renamed', async () => {
    const store = await signedInStore();
    const task = await store.dispatch(createTask(input())).unwrap();
    // Pretend the task was planned elsewhere.
    const db = await getTaskStore();
    await db.save({ ...task, timeZone: 'Europe/Berlin' });
    await store.dispatch(fetchTasks());

    const renamed = await store
      .dispatch(updateTask({ id: task.id, changes: { title: 'Renamed' } }))
      .unwrap();
    expect(renamed.timeZone).toBe('Europe/Berlin');
    const moved = await store
      .dispatch(
        updateTask({ id: task.id, changes: { scheduledAt: '2030-02-01T03:30:00.000Z' } }),
      )
      .unwrap();
    expect(moved.timeZone).toBe('Asia/Kolkata');
  });

  it('deletes with a tombstone, and undo brings the task back', async () => {
    const store = await signedInStore();
    const task = await store.dispatch(createTask(input())).unwrap();
    await store.dispatch(deleteTask(task)).unwrap();

    const db = await getTaskStore();
    expect(store.getState().tasks.ids).toEqual([]);
    expect((await db.get(task.id))?.deletedAt).not.toBeNull();

    const restored = await store.dispatch(restoreTask(task)).unwrap();
    expect(Date.parse(restored.updatedAt)).toBeGreaterThan(
      Date.parse((await db.get(task.id))!.updatedAt) - 1,
    );
    expect((await db.get(task.id))?.deletedAt).toBeNull();
    expect(store.getState().tasks.ids).toEqual([task.id]);
  });

  it('clears completed tasks', async () => {
    const store = await signedInStore();
    const done = await store.dispatch(createTask(input({ title: 'Done' }))).unwrap();
    await store.dispatch(createTask(input({ title: 'Open' })));
    await store.dispatch(setTaskCompleted({ task: done, completed: true }));

    expect(await store.dispatch(clearCompleted()).unwrap()).toEqual([done.id]);
    expect(
      Object.values(store.getState().tasks.entities).map(t => t.title),
    ).toEqual(['Open']);
    expect((await (await getTaskStore()).all()).map(t => t.title)).toEqual(['Open']);
  });

  it("empties the phone's database when another account signs in", async () => {
    const store = await signedInStore();
    await store.dispatch(createTask(input()));

    store.dispatch({
      type: restoreSession.fulfilled.type,
      payload: { ...user, id: 'u2' },
    });
    const tasks = await store.dispatch(fetchTasks()).unwrap();
    expect(tasks).toEqual([]);
  });
});
