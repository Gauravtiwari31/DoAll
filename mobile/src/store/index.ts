import {
  configureStore,
  createListenerMiddleware,
  isAnyOf,
} from '@reduxjs/toolkit';
import { setSessionExpiredHandler } from '../api/client';
import authReducer, { sessionExpired } from '../features/auth/authSlice';
import preferencesReducer, {
  setSort,
  setThemeMode,
} from '../features/preferences/preferencesSlice';
import tasksReducer from '../features/tasks/tasksSlice';
import { STORAGE_KEYS, storage } from '../services/storage';

/** Side effects that react to actions (kept out of reducers, which must stay pure). */
const listener = createListenerMiddleware();

// Persist device preferences whenever they change.
listener.startListening({
  matcher: isAnyOf(setThemeMode, setSort),
  effect: async (_action, api) => {
    await storage.set(
      STORAGE_KEYS.preferences,
      (api.getState() as RootState).preferences,
    );
  },
});

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tasks: tasksReducer,
    preferences: preferencesReducer,
  },
  middleware: getDefault => getDefault().prepend(listener.middleware),
});

// The HTTP layer can't import the store (circular), so it reports here instead.
setSessionExpiredHandler(() => store.dispatch(sessionExpired()));

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
