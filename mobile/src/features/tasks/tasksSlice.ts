import {
  createAsyncThunk,
  createEntityAdapter,
  createSlice,
  isAnyOf,
  PayloadAction,
} from '@reduxjs/toolkit';
import { getTaskStore } from '../../db';
import { device } from '../../services/device';
import type { RootState } from '../../store';
import {
  deleteAccount,
  login,
  logout,
  register,
  sessionExpired,
  signInWithGoogle,
} from '../auth/authSlice';
import { pulledWhileUnverified, syncNow } from '../sync/syncSlice';
import { nextOccurrence, sameRule } from './recurrence';
import {
  Category,
  Priority,
  Task,
  TaskFilters,
  TaskInput,
  TaskView,
} from './types';

/**
 * Tasks are stored normalised (ids + entities) so single-task updates are O(1)
 * and don't re-render unrelated rows.
 *
 * The phone's database is the source of truth: every change is saved there
 * first (instantly, offline too), then shown, and sync sends it to the server
 * in the background. Toggling and deleting also change the list before the
 * save finishes, and roll back if it fails.
 */
export const tasksAdapter = createEntityAdapter<Task>();

export type LoadStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface TasksState
  extends ReturnType<typeof tasksAdapter.getInitialState> {
  status: LoadStatus;
  error: string | null;
  filters: TaskFilters;
}

export const initialFilters: TaskFilters = {
  view: 'all',
  priority: null,
  category: null,
  search: '',
};

const initialState: TasksState = tasksAdapter.getInitialState({
  status: 'idle',
  error: null,
  filters: initialFilters,
});

type ThunkConfig = { state: RootState; rejectValue: string };

const SAVE_FAILED = "Couldn't save on this phone. Please try again.";

/**
 * A change's timestamp: now, but always after the task's previous change, so
 * sync orders this phone's edits correctly even if its clock went backwards.
 */
export const stamp = (previous?: string | null) =>
  new Date(
    Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0),
  ).toISOString();

/** The task as the store has it now (it may have changed since a screen read it). */
const latest = (state: RootState, task: Task) =>
  state.tasks.entities[task.id] ?? task;

/**
 * Loads the signed-in account's tasks from the phone. The database is handed
 * to this account first: if someone else used it, their tasks go.
 */
export const fetchTasks = createAsyncThunk<Task[], void, ThunkConfig>(
  'tasks/fetch',
  async (_arg, { getState, rejectWithValue }) => {
    const user = getState().auth.user;
    if (!user) {
      return rejectWithValue('Not signed in');
    }
    try {
      const store = await getTaskStore();
      await store.claim(user.id);
      return await store.all();
    } catch (error) {
      if (__DEV__) {
        console.warn('Loading tasks failed:', error);
      }
      return rejectWithValue("Couldn't open your tasks on this phone");
    }
  },
);

export const createTask = createAsyncThunk<Task, TaskInput, ThunkConfig>(
  'tasks/create',
  async (input, { rejectWithValue }) => {
    const now = stamp();
    const task: Task = {
      ...input,
      id: device.newId(),
      completed: false,
      completedAt: null,
      timeZone: device.timeZone(),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await (await getTaskStore()).save(task);
      return task;
    } catch {
      return rejectWithValue(SAVE_FAILED);
    }
  },
);

export const updateTask = createAsyncThunk<
  Task,
  { id: string; changes: Partial<TaskInput> },
  ThunkConfig
>('tasks/update', async ({ id, changes }, { getState, rejectWithValue }) => {
  const current = getState().tasks.entities[id];
  if (!current) {
    return rejectWithValue('This task no longer exists');
  }
  const next: Task = { ...current, ...changes, updatedAt: stamp(current.updatedAt) };
  // A new time was picked on this phone's clock: repeats follow this phone's zone.
  const rescheduled =
    next.scheduledAt !== current.scheduledAt ||
    !sameRule(next.recurrence, current.recurrence);
  if (rescheduled) {
    next.timeZone = device.timeZone();
  }
  try {
    await (await getTaskStore()).save(next);
    return next;
  } catch {
    return rejectWithValue(SAVE_FAILED);
  }
});

/**
 * Ticks a task off, or back on. A repeating task isn't marked done: it moves
 * on to its next occurrence (the deadline moves with it). The result tells
 * which happened: it is still open, with a later scheduledAt.
 */
export const setTaskCompleted = createAsyncThunk<
  Task,
  { task: Task; completed: boolean },
  ThunkConfig
>(
  'tasks/setCompleted',
  async ({ task, completed }, { getState, rejectWithValue }) => {
    const current = latest(getState(), task);
    const updatedAt = stamp(current.updatedAt);
    let next: Task = {
      ...current,
      completed,
      completedAt: completed ? updatedAt : null,
      updatedAt,
    };
    if (completed && current.recurrence) {
      const start = Date.parse(current.scheduledAt);
      const following = nextOccurrence(
        start,
        current.recurrence,
        current.timeZone,
        Math.max(start, Date.now()),
      );
      if (following !== null) {
        const shift = following - start;
        next = {
          ...current,
          scheduledAt: new Date(following).toISOString(),
          deadline: current.deadline
            ? new Date(Date.parse(current.deadline) + shift).toISOString()
            : null,
          updatedAt,
        };
      }
    }
    try {
      await (await getTaskStore()).save(next);
      return next;
    } catch {
      return rejectWithValue(SAVE_FAILED);
    }
  },
);

/** Optimistic: removed from the list at once, restored if the save fails. */
export const deleteTask = createAsyncThunk<void, Task, ThunkConfig>(
  'tasks/delete',
  async (task, { rejectWithValue }) => {
    try {
      await (await getTaskStore()).remove(task.id, stamp(task.updatedAt));
    } catch {
      return rejectWithValue(SAVE_FAILED);
    }
  },
);

/** "Undo" for a delete: brings the task back as it was. */
export const restoreTask = createAsyncThunk<Task, Task, ThunkConfig>(
  'tasks/restore',
  async (task, { rejectWithValue }) => {
    try {
      const store = await getTaskStore();
      // After the deletion, so the server takes the restore over it.
      const deleted = await store.get(task.id);
      const restored = {
        ...task,
        updatedAt: stamp(deleted?.updatedAt ?? task.updatedAt),
      };
      await store.save(restored);
      return restored;
    } catch {
      return rejectWithValue(SAVE_FAILED);
    }
  },
);

/** Deletes every completed task; resolves with their IDs. */
export const clearCompleted = createAsyncThunk<string[], void, ThunkConfig>(
  'tasks/clearCompleted',
  async (_arg, { getState, rejectWithValue }) => {
    const done = Object.values(getState().tasks.entities).filter(
      task => task.completed,
    );
    try {
      const store = await getTaskStore();
      for (const task of done) {
        await store.remove(task.id, stamp(task.updatedAt));
      }
      return done.map(task => task.id);
    } catch {
      return rejectWithValue(SAVE_FAILED);
    }
  },
);

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setView(state, action: PayloadAction<TaskView>) {
      state.filters.view = action.payload;
    },
    setPriorityFilter(state, action: PayloadAction<Priority | null>) {
      state.filters.priority = action.payload;
    },
    setCategoryFilter(state, action: PayloadAction<Category | null>) {
      state.filters.category = action.payload;
    },
    setSearch(state, action: PayloadAction<string>) {
      state.filters.search = action.payload;
    },
    resetFilters(state) {
      state.filters = { ...initialFilters, view: state.filters.view };
    },
  },
  extraReducers: builder => {
    builder
      // ---- load from the phone ---------------------------------------------
      .addCase(fetchTasks.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, { payload }) => {
        tasksAdapter.setAll(state, payload);
        state.status = 'succeeded';
      })
      .addCase(fetchTasks.rejected, (state, { payload }) => {
        state.status = 'failed';
        state.error = payload ?? "Couldn't open your tasks";
      })

      // ---- complete / un-complete (optimistic) -----------------------------
      .addCase(setTaskCompleted.pending, (state, { meta }) => {
        const { task, completed } = meta.arg;
        // A repeating task moves on instead, once saved.
        if (completed && task.recurrence) {
          return;
        }
        tasksAdapter.updateOne(state, {
          id: task.id,
          changes: {
            completed,
            completedAt: completed ? new Date().toISOString() : null,
          },
        });
      })
      .addCase(setTaskCompleted.rejected, (state, { meta }) => {
        const { task } = meta.arg;
        tasksAdapter.updateOne(state, {
          id: task.id,
          changes: { completed: task.completed, completedAt: task.completedAt },
        });
      })

      // ---- delete (optimistic) ---------------------------------------------
      .addCase(deleteTask.pending, (state, { meta }) => {
        tasksAdapter.removeOne(state, meta.arg.id);
      })
      .addCase(deleteTask.rejected, (state, { meta }) => {
        tasksAdapter.addOne(state, meta.arg);
      })

      .addCase(clearCompleted.fulfilled, (state, { payload }) => {
        tasksAdapter.removeMany(state, payload);
      })

      // What sync brought from the server.
      .addMatcher(
        isAnyOf(syncNow.fulfilled, pulledWhileUnverified),
        (state, { payload }) => {
          tasksAdapter.upsertMany(state, payload.saved);
          tasksAdapter.removeMany(state, payload.removed);
        },
      )

      // The saved versions.
      .addMatcher(
        isAnyOf(
          createTask.fulfilled,
          updateTask.fulfilled,
          setTaskCompleted.fulfilled,
          restoreTask.fulfilled,
        ),
        (state, { payload }) => {
          tasksAdapter.upsertOne(state, payload);
        },
      )

      // Never leak one user's tasks into the next session. The phone's
      // database is emptied on logout too (see store/listeners.ts).
      .addMatcher(
        isAnyOf(
          logout.fulfilled,
          deleteAccount.fulfilled,
          sessionExpired,
          login.fulfilled,
          register.fulfilled,
          signInWithGoogle.fulfilled,
        ),
        () => initialState,
      );
  },
});

export const {
  setView,
  setPriorityFilter,
  setCategoryFilter,
  setSearch,
  resetFilters,
} = tasksSlice.actions;
export default tasksSlice.reducer;
