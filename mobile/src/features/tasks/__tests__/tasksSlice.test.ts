import {
  deleteAccount,
  login,
  logout,
  sessionExpired,
} from '../../auth/authSlice';
import reducer, {
  deleteTask,
  fetchTasks,
  setTaskCompleted,
  setView,
} from '../tasksSlice';
import { makeTask } from '../../../test-utils/fixtures';

const task = makeTask({ title: 'Write tests' });
const loaded = reducer(undefined, {
  type: fetchTasks.fulfilled.type,
  payload: [task],
});

describe('tasksSlice', () => {
  it('stores fetched tasks normalised by id', () => {
    expect(loaded.ids).toEqual([task.id]);
    expect(loaded.entities[task.id].title).toBe('Write tests');
    expect(loaded.status).toBe('succeeded');
  });

  it('completes optimistically and rolls back on failure', () => {
    const arg = { task, completed: true };
    const pending = reducer(loaded, {
      type: setTaskCompleted.pending.type,
      meta: { arg },
    });
    expect(pending.entities[task.id].completed).toBe(true);
    expect(pending.entities[task.id].completedAt).not.toBeNull();

    const failed = reducer(pending, {
      type: setTaskCompleted.rejected.type,
      meta: { arg },
      payload: 'Network down',
    });
    expect(failed.entities[task.id].completed).toBe(false);
    expect(failed.entities[task.id].completedAt).toBeNull();
  });

  it('deletes optimistically and restores on failure', () => {
    const pending = reducer(loaded, {
      type: deleteTask.pending.type,
      meta: { arg: task },
    });
    expect(pending.ids).toEqual([]);
    const failed = reducer(pending, {
      type: deleteTask.rejected.type,
      meta: { arg: task },
    });
    expect(failed.ids).toEqual([task.id]);
  });

  it('forgets everything on logout, account deletion or session expiry', () => {
    const filtered = reducer(loaded, setView('done'));
    for (const action of [
      { type: logout.fulfilled.type },
      { type: deleteAccount.fulfilled.type },
      sessionExpired(),
    ]) {
      const reset = reducer(filtered, action);
      expect(reset.ids).toEqual([]);
      expect(reset.filters.view).toBe('all');
      expect(reset.status).toBe('idle');
    }

    // A deletion the server refused leaves the list alone.
    const refused = reducer(filtered, {
      type: deleteAccount.rejected.type,
      payload: 'Incorrect password',
    });
    expect(refused).toEqual(filtered);
  });

  it('starts clean after signing in again, even if a request failed late', () => {
    // Session expires, then the in-flight fetch rejects after the reset.
    const expired = reducer(loaded, sessionExpired());
    const lateFailure = reducer(expired, {
      type: fetchTasks.rejected.type,
      payload: 'Session expired',
      meta: {},
    });
    expect(lateFailure.status).toBe('failed');

    const signedIn = reducer(lateFailure, { type: login.fulfilled.type });
    expect(signedIn.status).toBe('idle');
    expect(signedIn.error).toBeNull();
  });

  it('surfaces fetch errors', () => {
    const failed = reducer(undefined, {
      type: fetchTasks.rejected.type,
      payload: "Can't reach the DoAll server.",
      meta: {},
    });
    expect(failed.status).toBe('failed');
    expect(failed.error).toMatch(/Can't reach/);
  });
});
