import { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useStore } from 'react-redux';
import { syncNow } from '../features/sync/syncSlice';
import { AppStackParamList } from '../navigation/types';
import { reminders } from '../services/reminders';
import type { RootState } from '../store';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { refreshReminders } from '../store/listeners';

/**
 * While signed in, each time DoAll comes to the foreground: catch up with the
 * server, plan reminders from this moment on (so a repeating task's queue
 * never runs dry), and open the task whose reminder was tapped.
 */
export function useAppLifecycle(
  navigation: NavigationContainerRefWithCurrent<AppStackParamList>,
) {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const signedIn = useAppSelector(state => state.auth.status === 'signedIn');
  const loaded = useAppSelector(state => state.tasks.status === 'succeeded');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    const onForeground = () => {
      dispatch(syncNow());
      refreshReminders(store.getState);
      reminders
        .takeOpenedTaskId()
        .then(id => id && setOpenTaskId(id))
        .catch(() => undefined);
    };
    onForeground();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        onForeground();
      }
    });
    return () => subscription.remove();
  }, [signedIn, dispatch, store]);

  // Once the tasks are loaded and the screens exist.
  useEffect(() => {
    if (!openTaskId || !loaded || !navigation.isReady()) {
      return;
    }
    setOpenTaskId(null);
    if (store.getState().tasks.entities[openTaskId]) {
      navigation.navigate('TaskDetail', { id: openTaskId });
    }
  }, [openTaskId, loaded, navigation, store]);
}
