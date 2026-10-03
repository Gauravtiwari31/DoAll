import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { ConfirmProvider, ToastProvider } from './components/ui';
import { restoreSession } from './features/auth/authSlice';
import {
  preferencesHydrated,
  PreferencesState,
} from './features/preferences/preferencesSlice';
import { RootNavigator } from './navigation/RootNavigator';
import { STORAGE_KEYS, storage } from './services/storage';
import { store } from './store';
import { ThemeProvider } from './theme';

/**
 * Startup: load saved preferences first (so the right theme paints on the
 * first frame), then check for a saved session. The splash screen stays up
 * until `auth.status` leaves 'restoring'.
 */
async function bootstrap() {
  store.dispatch(
    preferencesHydrated(
      await storage.get<PreferencesState>(STORAGE_KEYS.preferences),
    ),
  );
  await store.dispatch(restoreSession());
}

export default function App() {
  useEffect(() => {
    bootstrap();
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <RootNavigator />
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}
