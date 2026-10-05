import {
  createAction,
  createAsyncThunk,
  createSlice,
  isAnyOf,
} from '@reduxjs/toolkit';
import { isAxiosError } from 'axios';
import { getErrorMessage, isNetworkError } from '../../api/errors';
import { syncApi } from '../../api/syncApi';
import { getTaskStore } from '../../db';
import { runSync, SyncResult } from '../../sync/engine';
import type { RootState } from '../../store';
import {
  deleteAccount,
  login,
  logout,
  register,
  signInWithGoogle,
} from '../auth/authSlice';

/**
 * - idle: up to date, or nothing to do yet
 * - syncing: a sync is running
 * - offline: the server couldn't be reached; retried automatically
 * - unverified: the server wants a confirmed email address first
 * - error: the server refused or failed; retried automatically
 */
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'unverified' | 'error';

export interface SyncState {
  status: SyncStatus;
  /** When the last sync finished (ISO), on this phone. */
  lastSyncedAt: string | null;
  /** Message of the latest failure, kept for the diagnostics card. */
  lastError: string | null;
  /** Failures since the last successful sync (drives the retry back-off). */
  failures: number;
  /** Changes on the phone the server doesn't have yet. */
  pending: number;
}

const initialState: SyncState = {
  status: 'idle',
  lastSyncedAt: null,
  lastError: null,
  failures: 0,
  pending: 0,
};

/** `code` of the server's 403 while the email address isn't confirmed. */
const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

type SyncFailure = { kind: 'offline' | 'unverified' | 'error'; message: string };

function classify(error: unknown): SyncFailure {
  if (isNetworkError(error)) {
    return { kind: 'offline', message: "Couldn't reach the server" };
  }
  if (
    isAxiosError(error) &&
    error.response?.status === 403 &&
    (error.response.data as { code?: string } | undefined)?.code ===
      EMAIL_NOT_VERIFIED
  ) {
    return { kind: 'unverified', message: getErrorMessage(error) };
  }
  return { kind: 'error', message: getErrorMessage(error) };
}

/** Tasks downloaded while uploads wait for a confirmed email address. */
export const pulledWhileUnverified = createAction<SyncResult>(
  'sync/pulledWhileUnverified',
);

/** Set when a sync was asked for while one was running: it runs once more after. */
let again = false;

/** Whether another sync is due after the one that just ended (and resets that). */
export function takeRerun(): boolean {
  const due = again;
  again = false;
  return due;
}

/**
 * Sends the phone's changes and fetches the server's. Only once signed in
 * and the phone's tasks are loaded (they belong to the signed-in account).
 */
export const syncNow = createAsyncThunk<
  SyncResult & { pending: number },
  void,
  { state: RootState; rejectValue: SyncFailure }
>(
  'sync/run',
  async (_arg, { dispatch, rejectWithValue }) => {
    const store = await getTaskStore();
    try {
      const result = await runSync(store, syncApi.sync);
      return { ...result, pending: await store.pendingCount() };
    } catch (error) {
      const failure = classify(error);
      if (failure.kind === 'unverified') {
        // Still bring down what the account already has on the server.
        try {
          const pulled = await runSync(store, syncApi.sync, { push: false });
          dispatch(pulledWhileUnverified(pulled));
        } catch {
          // Reported as unverified either way.
        }
      }
      return rejectWithValue(failure);
    }
  },
  {
    condition: (_arg, { getState }) => {
      const { auth, tasks, sync } = getState();
      if (auth.status !== 'signedIn' || tasks.status !== 'succeeded') {
        return false;
      }
      // One at a time.
      if (sync.status === 'syncing') {
        again = true;
        return false;
      }
      return true;
    },
  },
);

/** Counts the changes waiting to be sent, for the profile screen. */
export const countPending = createAsyncThunk('sync/countPending', async () =>
  (await getTaskStore()).pendingCount(),
);

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(syncNow.pending, state => {
        state.status = 'syncing';
      })
      .addCase(syncNow.fulfilled, (state, { payload }) => {
        state.status = 'idle';
        state.lastSyncedAt = new Date().toISOString();
        state.failures = 0;
        state.pending = payload.pending;
      })
      .addCase(syncNow.rejected, (state, { payload }) => {
        state.status = payload?.kind ?? 'error';
        state.lastError = payload?.message ?? 'Sync failed';
        state.failures += 1;
      })
      .addCase(countPending.fulfilled, (state, { payload }) => {
        state.pending = payload;
      })
      // A new session starts with a clean slate.
      .addMatcher(
        isAnyOf(
          logout.fulfilled,
          deleteAccount.fulfilled,
          login.fulfilled,
          register.fulfilled,
          signInWithGoogle.fulfilled,
        ),
        () => initialState,
      );
  },
});

export default syncSlice.reducer;
