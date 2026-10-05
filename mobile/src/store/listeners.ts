import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import {
  deleteAccount,
  logout,
  sessionExpired,
} from '../features/auth/authSlice';
import {
  setSort,
  setThemeMode,
} from '../features/preferences/preferencesSlice';
import {
  countPending,
  pulledWhileUnverified,
  syncNow,
  takeRerun,
} from '../features/sync/syncSlice';
import {
  clearCompleted,
  createTask,
  deleteTask,
  fetchTasks,
  restoreTask,
  setTaskCompleted,
  updateTask,
} from '../features/tasks/tasksSlice';
import { reminders } from '../services/reminders';
import { STORAGE_KEYS, storage } from '../services/storage';
import type { AppDispatch, RootState } from './index';

/** Side effects that react to actions (kept out of reducers, which must stay pure). */
export const listener = createListenerMiddleware();

const startListening = listener.startListening.withTypes<
  RootState,
  AppDispatch
>();

/** Edits made in quick succession go up in one sync. */
const SYNC_DEBOUNCE_MS = 2_000;
/** Retries after a failed sync wait 5 s, 10 s, 20 s... up to 5 minutes. */
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;
/** Reminders are planned again once a burst of changes settles. */
const REMINDER_DEBOUNCE_MS = 500;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let reminderTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync(dispatch: AppDispatch, delay: number) {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  syncTimer = setTimeout(() => {
    syncTimer = null;
    dispatch(syncNow());
  }, delay);
}

function scheduleReminders(getState: () => RootState) {
  if (reminderTimer) {
    clearTimeout(reminderTimer);
  }
  reminderTimer = setTimeout(() => {
    reminderTimer = null;
    const { entities, ids } = getState().tasks;
    reminders
      .schedule(ids.map(id => entities[id]))
      .catch(error => console.warn('[reminders] scheduling failed', error));
  }, REMINDER_DEBOUNCE_MS);
}

/** Stops pending syncs and reminder planning (signed out). */
function cancelTimers() {
  for (const timer of [syncTimer, reminderTimer]) {
    if (timer) {
      clearTimeout(timer);
    }
  }
  syncTimer = null;
  reminderTimer = null;
}

/** Re-plans reminders now, e.g. when the app comes back to the foreground. */
export function refreshReminders(getState: () => RootState) {
  scheduleReminders(getState);
}

// Persist device preferences whenever they change.
startListening({
  matcher: isAnyOf(setThemeMode, setSort),
  effect: async (_action, api) => {
    await storage.set(STORAGE_KEYS.preferences, api.getState().preferences);
  },
});

// A change on the phone: count it, send it soon, and plan its reminders.
startListening({
  matcher: isAnyOf(
    createTask.fulfilled,
    updateTask.fulfilled,
    setTaskCompleted.fulfilled,
    deleteTask.fulfilled,
    restoreTask.fulfilled,
    clearCompleted.fulfilled,
  ),
  effect: (_action, api) => {
    api.dispatch(countPending());
    scheduleSync(api.dispatch, SYNC_DEBOUNCE_MS);
    scheduleReminders(api.getState);
  },
});

// The phone's tasks are loaded: plan reminders and catch up with the server.
startListening({
  actionCreator: fetchTasks.fulfilled,
  effect: (_action, api) => {
    api.dispatch(countPending());
    scheduleReminders(api.getState);
    api.dispatch(syncNow());
  },
});

startListening({
  matcher: isAnyOf(syncNow.fulfilled, pulledWhileUnverified),
  effect: (action, api) => {
    const { payload } = action as ReturnType<typeof pulledWhileUnverified>;
    if (payload.saved.length > 0 || payload.removed.length > 0) {
      scheduleReminders(api.getState);
    }
  },
});

startListening({
  actionCreator: syncNow.fulfilled,
  effect: (_action, api) => {
    if (takeRerun()) {
      api.dispatch(syncNow());
    }
  },
});

startListening({
  actionCreator: syncNow.rejected,
  effect: ({ payload }, api) => {
    if (takeRerun()) {
      api.dispatch(syncNow());
      return;
    }
    // Waiting for a confirmed email: retried when the app comes back, not on a timer.
    if (payload?.kind === 'offline' || payload?.kind === 'error') {
      const failures = api.getState().sync.failures;
      scheduleSync(
        api.dispatch,
        Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS),
      );
    }
  },
});

// Signed out: nothing more to send or remind of. (Logout and account
// deletion empty the phone's database themselves; an expired session keeps
// it, so nothing is lost before the same person signs in again.)
startListening({
  matcher: isAnyOf(logout.fulfilled, deleteAccount.fulfilled, sessionExpired),
  effect: () => {
    cancelTimers();
    takeRerun();
  },
});
