import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { authApi, Credentials, Registration, User } from '../../api/authApi';
import { getErrorMessage, isNetworkError } from '../../api/errors';
import { session } from '../../services/session';
import { STORAGE_KEYS, storage } from '../../services/storage';

/**
 * - `restoring`: app just launched, checking for a saved session (splash screen)
 * - `signedOut`: show the auth stack
 * - `signedIn`:  show the app
 */
export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** A login/register request is in flight. */
  submitting: boolean;
  /** Shown once on the login screen, e.g. after the session expired. */
  notice: string | null;
}

const initialState: AuthState = {
  status: 'restoring',
  user: null,
  submitting: false,
  notice: null,
};

/** On launch: reuse saved tokens if they are still accepted by the server. */
export const restoreSession = createAsyncThunk<User | null>(
  'auth/restore',
  async () => {
    const saved = await session.restore();
    if (!saved) {
      return null;
    }
    try {
      const user = await authApi.me(); // refreshes the access token if needed
      await storage.set(STORAGE_KEYS.user, user);
      return user;
    } catch (error) {
      // Offline? Trust the cached profile so the app still opens.
      if (isNetworkError(error)) {
        return storage.get<User>(STORAGE_KEYS.user);
      }
      await session.clear();
      return null;
    }
  },
);

const completeSignIn = async ({
  user,
  tokens,
}: Awaited<ReturnType<typeof authApi.login>>) => {
  await session.save(tokens);
  await storage.set(STORAGE_KEYS.user, user);
  return user;
};

export const login = createAsyncThunk<
  User,
  Credentials,
  { rejectValue: string }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    return await completeSignIn(await authApi.login(credentials));
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const register = createAsyncThunk<
  User,
  Registration,
  { rejectValue: string }
>('auth/register', async (registration, { rejectWithValue }) => {
  try {
    return await completeSignIn(await authApi.register(registration));
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

/** Revokes the refresh token server-side (best effort) and forgets it locally. */
export const logout = createAsyncThunk('auth/logout', async () => {
  const current = session.get();
  if (current) {
    await authApi.logout(current.refreshToken).catch(() => undefined);
  }
  await session.clear();
  await storage.remove(STORAGE_KEYS.user);
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Dispatched by the API client when a refresh token is rejected. */
    sessionExpired(state) {
      state.status = 'signedOut';
      state.user = null;
      state.notice = 'Your session expired. Please log in again.';
    },
    clearNotice(state) {
      state.notice = null;
    },
    userUpdated(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(restoreSession.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.status = payload ? 'signedIn' : 'signedOut';
      })
      .addCase(restoreSession.rejected, state => {
        state.status = 'signedOut';
      })
      .addCase(logout.fulfilled, () => ({
        ...initialState,
        status: 'signedOut' as const,
      }));

    // login & register share the same lifecycle.
    for (const thunk of [login, register]) {
      builder
        .addCase(thunk.pending, state => {
          state.submitting = true;
          state.notice = null;
        })
        .addCase(thunk.fulfilled, (state, { payload }) => {
          state.submitting = false;
          state.user = payload;
          state.status = 'signedIn';
        })
        .addCase(thunk.rejected, state => {
          state.submitting = false;
        });
    }
  },
});

export const { sessionExpired, clearNotice, userUpdated } = authSlice.actions;
export default authSlice.reducer;
