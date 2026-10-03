import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  isAxiosError,
} from 'axios';
import { REQUEST_TIMEOUT_MS, TOKEN_REFRESH_MARGIN_MS } from '../config';
import { server } from '../services/server';
import { AuthTokens, session } from '../services/session';

/** Pre-configured HTTP client for the DoAll API (base URL set per request). */
export const api = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

let onSessionExpired: () => void = () => {};

/** Registered by the store so the client can sign the user out when refresh fails. */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

/**
 * Single-flight refresh: if several requests hit an expired token at once,
 * they all await the same refresh call. This matters because the server
 * rotates refresh tokens and treats a replayed one as theft.
 */
let refreshInFlight: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const current = session.get();
      if (!current) {
        return null;
      }
      try {
        // Plain axios (not `api`) so this call bypasses our own interceptors.
        const { data } = await axios.post<{ tokens: AuthTokens }>(
          `${server.getUrl()}/auth/refresh`,
          { refreshToken: current.refreshToken },
          { timeout: REQUEST_TIMEOUT_MS },
        );
        await session.save(data.tokens);
        return data.tokens.accessToken;
      } catch (error) {
        // Only a definitive "no" from the server ends the session; network
        // hiccups keep the tokens so the next attempt can succeed.
        if (isAxiosError(error) && error.response?.status === 401) {
          await session.clear();
          onSessionExpired();
        }
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

// Attach the access token, refreshing it first if it is about to expire.
api.interceptors.request.use(async config => {
  // The server address can change at runtime (welcome screen setting).
  config.baseURL = server.getUrl();
  let current = session.get();
  if (current && current.expiresAt - Date.now() < TOKEN_REFRESH_MARGIN_MS) {
    await refreshAccessToken();
    current = session.get();
  }
  if (current) {
    config.headers.Authorization = `Bearer ${current.accessToken}`;
  }
  return config;
});

// If the server still says 401 (e.g. token revoked), refresh once and replay.
api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      session.get()
    ) {
      original._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);
