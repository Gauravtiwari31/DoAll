import { configureStore } from '@reduxjs/toolkit';
import { setSessionExpiredHandler } from '../api/client';
import authReducer, { sessionExpired } from '../features/auth/authSlice';
import preferencesReducer from '../features/preferences/preferencesSlice';
import syncReducer from '../features/sync/syncSlice';
import tasksReducer from '../features/tasks/tasksSlice';
import { listener } from './listeners';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tasks: tasksReducer,
    sync: syncReducer,
    preferences: preferencesReducer,
  },
  middleware: getDefault => getDefault().prepend(listener.middleware),
});

// The HTTP layer can't import the store (circular), so it reports here instead.
setSessionExpiredHandler(() => store.dispatch(sessionExpired()));

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
