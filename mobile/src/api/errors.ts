import { isAxiosError } from 'axios';

/**
 * Turns anything thrown by the API layer into one human-readable sentence.
 * Nest validation errors arrive as `message: string[]`; we show the first.
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Try again.',
): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return error.code === 'ECONNABORTED'
        ? 'The server is taking a while. If it was asleep it will be up in a few seconds, so try again.'
        : "Can't reach the DoAll server. Check it's running and the server address is right.";
    }
    const message = (error.response.data as { message?: unknown } | undefined)
      ?.message;
    if (Array.isArray(message) && typeof message[0] === 'string') {
      return message[0];
    }
    if (typeof message === 'string') {
      return message;
    }
    return fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

/** True for "server unreachable" style failures (as opposed to a 4xx/5xx answer). */
export const isNetworkError = (error: unknown) =>
  isAxiosError(error) && !error.response;

export const isUnauthorized = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 401;

/** 403: signed in, but the server refused (e.g. a wrong confirmation password). */
export const isForbidden = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 403;

/**
 * Signing in with Google found an email/password account with the same
 * address: the server answers 409 with this code and the address, and
 * connects the two once that account's password is sent along.
 * Returns the address, or null for any other error.
 */
export function googleLinkEmail(error: unknown): string | null {
  if (!isAxiosError(error) || error.response?.status !== 409) {
    return null;
  }
  const body = error.response.data as { code?: unknown; email?: unknown };
  return body?.code === 'GOOGLE_LINK_PASSWORD_REQUIRED' &&
    typeof body.email === 'string'
    ? body.email
    : null;
}
