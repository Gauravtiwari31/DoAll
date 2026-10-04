import {
  createAsyncThunk,
  createEntityAdapter,
  createSlice,
  isAnyOf,
  PayloadAction,
} from '@reduxjs/toolkit';
import { getErrorMessage } from '../../api/errors';
import { tasksApi } from '../../api/tasksApi';
import {
  deleteAccount,
  login,
  logout,
  register,
  sessionExpired,
} from '../auth/authSlice';
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
 * and don't re-render unrelated rows. Toggling and deleting are optimistic:
 * the UI changes immediately and rolls back if the server disagrees.
 */
export const tasksAdapter = createEntityAdapter<Task>();

export type LoadStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface TasksState
  extends ReturnType<typeof tasksAdapter.getInitialState> {
  status: LoadStatus;
  refreshing: boolean;
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
  refreshing: false,
  error: null,
  filters: initialFilters,
});

type Reject = { rejectValue: string };

export const fetchTasks = createAsyncThunk<
  Task[],
  { refresh?: boolean } | void,
  Reject
>('tasks/fetch', async (_arg, { rejectWithValue }) => {
  try {
    return await tasksApi.list();
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const createTask = createAsyncThunk<Task, TaskInput, Reject>(
  'tasks/create',
  async (input, { rejectWithValue }) => {
    try {
      return await tasksApi.create(input);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const updateTask = createAsyncThunk<
  Task,
  { id: string; changes: Partial<TaskInput> },
  Reject
>('tasks/update', async ({ id, changes }, { rejectWithValue }) => {
  try {
    return await tasksApi.update(id, changes);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

/** Optimistic: see the `pending` / `rejected` reducers below. */
export const setTaskCompleted = createAsyncThunk<
  Task,
  { task: Task; completed: boolean },
  Reject
>('tasks/setCompleted', async ({ task, completed }, { rejectWithValue }) => {
  try {
    return await tasksApi.setCompleted(task.id, completed);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

/** Optimistic: removed from the list at once, restored if the request fails. */
export const deleteTask = createAsyncThunk<void, Task, Reject>(
  'tasks/delete',
  async (task, { rejectWithValue }) => {
    try {
      await tasksApi.remove(task.id);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

/** "Undo" for a delete: re-creates the task with the same content and status. */
export const restoreTask = createAsyncThunk<Task, Task, Reject>(
  'tasks/restore',
  async (task, { rejectWithValue }) => {
    try {
      const {
        title,
        description,
        scheduledAt,
        deadline,
        priority,
        category,
        tags,
      } = task;
      const created = await tasksApi.create({
        title,
        description,
        scheduledAt,
        deadline,
        priority,
        category,
        tags,
      });
      return task.completed
        ? await tasksApi.setCompleted(created.id, true)
        : created;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const clearCompleted = createAsyncThunk<number, void, Reject>(
  'tasks/clearCompleted',
  async (_arg, { rejectWithValue }) => {
    try {
      return (await tasksApi.clearCompleted()).deleted;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
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
      // ---- fetch -----------------------------------------------------------
      .addCase(fetchTasks.pending, (state, { meta }) => {
        if (meta.arg && meta.arg.refresh) {
          state.refreshing = true;
        } else {
          state.status = 'loading';
        }
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, { payload }) => {
        tasksAdapter.setAll(state, payload);
        state.status = 'succeeded';
        state.refreshing = false;
      })
      .addCase(fetchTasks.rejected, (state, { payload }) => {
        state.status = 'failed';
        state.refreshing = false;
        state.error = payload ?? 'Could not load tasks';
      })

      // ---- complete / un-complete (optimistic) -----------------------------
      .addCase(setTaskCompleted.pending, (state, { meta }) => {
        const { task, completed } = meta.arg;
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

      .addCase(clearCompleted.fulfilled, state => {
        const doneIds = Object.values(state.entities)
          .filter(task => task.completed)
          .map(task => task.id);
        tasksAdapter.removeMany(state, doneIds);
      })

      // Server responses are the source of truth for these.
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

      // Never leak one user's tasks into the next session. Signing in also
      // resets, so a request that failed after the session expired can't
      // leave the next session stuck in an error state.
      .addMatcher(
        isAnyOf(
          logout.fulfilled,
          deleteAccount.fulfilled,
          sessionExpired,
          login.fulfilled,
          register.fulfilled,
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
