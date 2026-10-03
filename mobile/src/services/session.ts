import { STORAGE_KEYS, storage } from './storage';

/** Token pair as returned by the API. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Device-clock timestamp (ms) after which the access token should be refreshed. */
  expiresAt: number;
}

/**
 * Holds the current token pair in memory (fast, synchronous reads for every
 * request) and mirrors it to app-private storage so the user stays signed in
 * across restarts. Tokens deliberately live outside Redux: they are secrets,
 * not UI state, and nothing should re-render when they rotate.
 */
let current: Session | null = null;

export const session = {
  get: (): Session | null => current,

  async restore(): Promise<Session | null> {
    current = await storage.get<Session>(STORAGE_KEYS.session);
    return current;
  },

  async save(tokens: AuthTokens): Promise<void> {
    current = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    };
    await storage.set(STORAGE_KEYS.session, current);
  },

  async clear(): Promise<void> {
    current = null;
    await storage.remove(STORAGE_KEYS.session);
  },
};
