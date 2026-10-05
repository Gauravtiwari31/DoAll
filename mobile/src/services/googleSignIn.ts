import { GOOGLE_WEB_CLIENT_ID } from '../config';
import NativeGoogleSignIn from '../native/NativeGoogleSignIn';

/** Why choosing a Google account produced no ID token. */
export class GoogleSignInError extends Error {
  constructor(readonly reason: 'unavailable' | 'failed', message: string) {
    super(message);
    this.name = 'GoogleSignInError';
  }
}

const UNAVAILABLE =
  "Google sign-in isn't available on this phone. Use your email and password instead.";
const FAILED = "Google sign-in didn't work. Please try again.";

/**
 * Google's account chooser (Android Credential Manager, see
 * native/NativeGoogleSignIn.ts). It only produces an ID token; signing in to
 * DoAll with it happens on the server (features/auth/authSlice.ts).
 */
export const googleSignIn = {
  /** This build knows the server's client ID and has the native code. */
  isAvailable: (): boolean =>
    Boolean(GOOGLE_WEB_CLIENT_ID && NativeGoogleSignIn),

  /**
   * Lets the person choose a Google account. Resolves with an ID token for the
   * server, or null if they backed out; rejects with a GoogleSignInError.
   */
  async chooseAccount(): Promise<string | null> {
    if (!GOOGLE_WEB_CLIENT_ID || !NativeGoogleSignIn) {
      throw new GoogleSignInError('unavailable', UNAVAILABLE);
    }
    try {
      return await NativeGoogleSignIn.signIn(GOOGLE_WEB_CLIENT_ID);
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      if (code === 'cancelled') {
        return null;
      }
      // A wrong client ID or a missing SHA-1 fingerprint shows up here.
      if (__DEV__) {
        console.warn('Google sign-in failed:', error);
      }
      throw code === 'unavailable'
        ? new GoogleSignInError('unavailable', UNAVAILABLE)
        : new GoogleSignInError('failed', FAILED);
    }
  },

  /** Forgets the chosen account on logout. Best effort, never throws. */
  async signOut(): Promise<void> {
    await NativeGoogleSignIn?.signOut().catch(() => undefined);
  },
};
