import type { CookieOptions, Request } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ACCOUNT_DELETE_GOOGLE_CALLBACK_PATH } from './legal.constants';

/*
 * Helpers for "Delete with Google" on the account deletion page, a standard
 * OAuth authorization code flow:
 *   1. The page's form posts to ACCOUNT_DELETE_GOOGLE_PATH. A random `state`
 *      and `nonce` go into a short-lived cookie, and the browser is sent to
 *      Google's account chooser with them.
 *   2. Google sends the browser back to the callback with a one-time code and
 *      the same `state`. A matching cookie proves the sign-in was started here,
 *      in this browser; the nonce inside the ID token proves the token answers
 *      that very request.
 */

export const GOOGLE_FLOW_COOKIE = 'doall_google_delete';
const CALLBACK_URL = `/${ACCOUNT_DELETE_GOOGLE_CALLBACK_PATH}`;

/** The state and nonce of one sign-in attempt. */
export interface GoogleFlow {
  state: string;
  nonce: string;
}

export const newGoogleFlow = (): GoogleFlow => ({
  state: randomBytes(32).toString('base64url'),
  nonce: randomBytes(32).toString('base64url'),
});

/** For the cookie that carries a GoogleFlow from step 1 to step 2. */
export function googleFlowCookie(req: Request): CookieOptions {
  return {
    httpOnly: true,
    secure: req.secure,
    // Lax, not Strict: the way back is a navigation that starts on accounts.google.com.
    sameSite: 'lax',
    path: CALLBACK_URL,
    maxAge: 10 * 60 * 1000,
  };
}

export const serializeGoogleFlow = ({ state, nonce }: GoogleFlow) => `${state}.${nonce}`;

/** Reads the flow back from the request's cookies, if there is one. */
export function readGoogleFlow(req: Request): GoogleFlow | null {
  const value = readCookie(req.headers.cookie, GOOGLE_FLOW_COOKIE);
  const [state, nonce] = value?.split('.') ?? [];
  return state && nonce ? { state, nonce } : null;
}

/** Compares secrets in constant time, so response times don't leak them. */
export function sameSecret(expected: string, actual: unknown): boolean {
  if (typeof actual !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Google's redirect target. It must be listed exactly like this in the OAuth client's settings. */
export const googleCallbackUrl = (req: Request) =>
  `${req.protocol}://${req.get('host')}${CALLBACK_URL}`;

/**
 * True when a form was posted from one of this server's own pages, so another
 * website can't start a deletion for whoever happens to visit it. Browsers
 * label requests with Sec-Fetch-Site; older ones only send Origin.
 */
export function isSameOriginPost(req: Request): boolean {
  const site = req.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = req.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return undefined;
}
