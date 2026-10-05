import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** What the reminders screen shows about the phone's settings. */
export type ReminderStatus = {
  /** The user allows DoAll's notifications (Android 13+ asks for this). */
  notificationsEnabled: boolean;
  /** Reminders go off on the minute. Otherwise Android may delay them up to ~10 minutes. */
  exactAlarmsAllowed: boolean;
  /** Battery optimisation is off for DoAll, so the system won't hold reminders back. */
  ignoringBatteryOptimizations: boolean;
  /** Reminders waiting in the queue. */
  scheduled: number;
  /** When the next one goes off (ms), or -1 if none. */
  nextAt: number;
};

/**
 * Task reminders as local notifications, scheduled with Android's
 * AlarmManager. Implemented in android/app/src/main/java/com/doall/reminders;
 * use it through services/reminders.ts.
 *
 * The app hands over its whole plan of upcoming reminders at once. Android
 * keeps only one alarm, for the next reminder, and moves on to the following
 * one each time it goes off, so the number of reminders isn't limited by the
 * phone's cap on alarms. The queue survives restarts and reboots.
 */
export interface Spec extends TurboModule {
  /**
   * Replaces every scheduled reminder. `json` is an array of
   * `{ id, taskId, title, body, fireAt }` with fireAt in ms.
   */
  setReminders(json: string): Promise<void>;
  getStatus(): Promise<ReminderStatus>;
  /**
   * Opens a system settings screen: `notifications`, `exactAlarms`,
   * `battery` (the battery optimisation list) or `app` (app info).
   * Resolves false if the phone has no such screen.
   */
  openSettings(kind: string): Promise<boolean>;
  /** The task of the notification that opened the app, once, or null. */
  takeOpenedTaskId(): Promise<string | null>;
}

/** Null where the native code doesn't exist (iOS, tests). */
export default TurboModuleRegistry.get<Spec>('DoAllReminders');
