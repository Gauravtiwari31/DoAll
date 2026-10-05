import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Sign in with Google through Android's Credential Manager. Implemented in
 * android/app/src/main/java/com/doall/googlesignin; React Native's codegen
 * turns this spec into the Kotlin interface it implements (see
 * "codegenConfig" in package.json). Use it through services/googleSignIn.ts.
 */
export interface Spec extends TurboModule {
  /**
   * Shows Google's account chooser. Resolves with an ID token issued to
   * `webClientId`, the server's OAuth client, so the server can check it.
   * Rejects with the error code `cancelled` when the person backs out,
   * `unavailable` when the phone can't offer Google accounts, or `failed`.
   */
  signIn(webClientId: string): Promise<string>;
  /** Forgets the account chosen last time. Never rejects. */
  signOut(): Promise<void>;
}

/** Null where the native code doesn't exist (iOS, tests). */
export default TurboModuleRegistry.get<Spec>('DoAllGoogleSignIn');
