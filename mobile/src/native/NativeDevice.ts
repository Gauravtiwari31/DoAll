import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Small things JavaScript can't do on its own here. Implemented in
 * android/app/src/main/java/com/doall/device.
 */
export interface Spec extends TurboModule {
  /** A random (version 4) UUID from the platform's secure random generator. */
  randomUUID(): string;
  /** The phone's IANA time zone, e.g. "Asia/Kolkata". */
  getTimeZone(): string;
  /**
   * Lets the user pick where to save a text file (Android's "Save to" screen)
   * and writes `contents` there. Resolves false if they backed out.
   */
  saveTextFile(
    fileName: string,
    mimeType: string,
    contents: string,
  ): Promise<boolean>;
}

/** Null where the native code doesn't exist (iOS, tests). */
export default TurboModuleRegistry.get<Spec>('DoAllDevice');
