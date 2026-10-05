import { PermissionsAndroid, Platform } from 'react-native';
import {
  DEFAULT_PLAN,
  planReminders,
} from '../features/reminders/planner';
import type { Task } from '../features/tasks/types';
import NativeReminders, { ReminderStatus } from '../native/NativeReminders';

export type SettingsScreen = 'notifications' | 'exactAlarms' | 'battery' | 'app';

/**
 * Local notifications for task reminders. They never need the server: the
 * phone schedules them itself (see native/NativeReminders.ts).
 */
export const reminders = {
  isAvailable: (): boolean => NativeReminders !== null,

  /** Replaces the scheduled reminders with those `tasks` need from now on. */
  async schedule(tasks: Task[], now = Date.now()): Promise<void> {
    if (!NativeReminders) {
      return;
    }
    const plan = planReminders(tasks, now, DEFAULT_PLAN);
    await NativeReminders.setReminders(JSON.stringify(plan));
  },

  /** Cancels every reminder (logout). */
  async clear(): Promise<void> {
    await NativeReminders?.setReminders('[]');
  },

  /**
   * Asks for permission to show notifications, which Android 13+ needs.
   * Called when someone first turns a reminder on, so the question makes
   * sense. Resolves with whether notifications are allowed.
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }
    }
    return (await reminders.status())?.notificationsEnabled ?? false;
  },

  status: (): Promise<ReminderStatus | null> =>
    NativeReminders ? NativeReminders.getStatus() : Promise.resolve(null),

  openSettings: (screen: SettingsScreen): Promise<boolean> =>
    NativeReminders
      ? NativeReminders.openSettings(screen)
      : Promise.resolve(false),

  /** The task whose reminder opened the app, once. */
  takeOpenedTaskId: (): Promise<string | null> =>
    NativeReminders
      ? NativeReminders.takeOpenedTaskId()
      : Promise.resolve(null),
};
