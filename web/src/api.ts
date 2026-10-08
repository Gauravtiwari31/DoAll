import { API_URL } from './config';
import { readJson, storage, STORAGE_KEYS } from './storage';
import type { AuthResponse, SyncRequest, SyncResponse, User } from './types';

/** The server answered with an error. `code` is set for the ones the site acts on. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The server couldn't be reached (offline, or it took too long to wake up). */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/** `code` of the 403 from /sync while the account's email address isn't confirmed. */
export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';
/** `code` of the 409 from /auth/google when the address has a password account. */
export const GOOGLE_LINK_PASSWORD_REQUIRED = 'GOOGLE_LINK_PASSWORD_REQUIRED';

/** The free Render plan takes up to a minute to wake the server. */
const TIMEOUT_MS = 70_000;
/** Refresh the access token this long before it expires. */
const REFRESH_MARGIN_MS = 60_000;

interface CallOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  token?: string;
}

async function call<T>(path: string, { method = 'GET', body, token }: CallOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new NetworkError(
      (error as Error).name === 'TimeoutError'
        ? 'The DoAll server is taking too long to answer. Try again in a minute.'
        : "Can't reach the DoAll server. Check your connection.",
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: a proxy's error page, say.
  }
  if (!response.ok) {
    const error = (data ?? {}) as { message?: unknown; code?: unknown };
    const message = Array.isArray(error.message) ? error.message[0] : error.message;
    throw new ApiError(
      response.status,
      typeof message === 'string' && message ? message : `The server answered ${response.status}`,
      typeof error.code === 'string' ? error.code : null,
    );
  }
  return data as T;
}

// ---- session ---------------------------------------------------------------

export interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
  /** When the access token expires, in ms. */
  expiresAt: number;
}

type Listener = (session: Session | null) => void;
const listeners = new Set<Listener>();
let current: Session | null = readJson<Session>(STORAGE_KEYS.session);

function setSession(session: Session | null, { persist = true } = {}) {
  current = session;
  if (persist) {
    if (session) {
      storage.set(STORAGE_KEYS.session, JSON.stringify(session));
    } else {
      storage.remove(STORAGE_KEYS.session);
    }
  }
  listeners.forEach(listener => listener(session));
}

const toSession = ({ user, tokens }: AuthResponse): Session => ({
  user,
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  expiresAt: Date.now() + tokens.expiresIn * 1000,
});

if (typeof window !== 'undefined') {
  // Signed in, refreshed or signed out in another tab.
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEYS.session) {
      setSession(readJson<Session>(STORAGE_KEYS.session), { persist: false });
    }
  });
}

/**
 * The server rotates refresh tokens and, if an old one is ever used again,
 * signs the account out everywhere (the phone too). Two tabs refreshing at
 * once would do exactly that, so refreshes take turns across tabs (Web Locks),
 * and each first checks whether another tab has already refreshed.
 */
async function refreshSession(stale: Session): Promise<Session | null> {
  const refresh = async (): Promise<Session | null> => {
    const latest = readJson<Session>(STORAGE_KEYS.session) ?? current;
    if (!latest) {
      return null;
    }
    if (latest.refreshToken !== stale.refreshToken) {
      setSession(latest, { persist: false });
      return latest;
    }
    try {
      const session = toSession(
        await call<AuthResponse>('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: latest.refreshToken },
        }),
      );
      setSession(session);
      return session;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setSession(null);
        return null;
      }
      throw error;
    }
  };
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('doall-token-refresh', refresh)
    : refresh();
}

let refreshing: Promise<Session | null> | null = null;

/** One refresh at a time within this tab too. */
function refreshOnce(stale: Session) {
  refreshing ??= refreshSession(stale).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

const SIGNED_OUT = () => new ApiError(401, 'You were signed out. Please sign in again.', null);

async function authed<T>(path: string, options: Omit<CallOptions, 'token'> = {}): Promise<T> {
  let session = current;
  if (!session) {
    throw SIGNED_OUT();
  }
  if (session.expiresAt - Date.now() < REFRESH_MARGIN_MS) {
    session = await refreshOnce(session);
    if (!session) {
      throw SIGNED_OUT();
    }
  }
  try {
    return await call<T>(path, { ...options, token: session.accessToken });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
    const renewed = await refreshOnce(session);
    if (!renewed) {
      throw SIGNED_OUT();
    }
    return call<T>(path, { ...options, token: renewed.accessToken });
  }
}

export const session = {
  get: () => current,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  /** Keeps a newer copy of the user (e.g. their address got confirmed). */
  updateUser(user: User) {
    if (current) {
      setSession({ ...current, user });
    }
  },
};

const signIn = async (request: Promise<AuthResponse>) => {
  const next = toSession(await request);
  setSession(next);
  return next;
};

export const api = {
  login: (email: string, password: string) =>
    signIn(call('/auth/login', { method: 'POST', body: { email, password } })),

  register: (name: string, email: string, password: string) =>
    signIn(call('/auth/register', { method: 'POST', body: { name, email, password } })),

  /** `password` only to connect Google to an existing email/password account. */
  google: (idToken: string, password?: string) =>
    signIn(
      call('/auth/google', {
        method: 'POST',
        body: password === undefined ? { idToken } : { idToken, password },
      }),
    ),

  forgotPassword: (email: string) =>
    call<void>('/auth/password/forgot', { method: 'POST', body: { email } }),

  resendVerification: () => authed<void>('/auth/verify-email/resend', { method: 'POST' }),

  me: () => authed<User>('/auth/me'),

  sync: (request: SyncRequest) => authed<SyncResponse>('/sync', { method: 'POST', body: request }),

  /** Ends this browser's session on the server too; signs out here even if that fails. */
  async logout() {
    const ending = current;
    setSession(null);
    if (ending) {
      await call<void>('/auth/logout', {
        method: 'POST',
        body: { refreshToken: ending.refreshToken },
      }).catch(() => undefined);
    }
  },
};
