import { AuthTokens } from '../services/session';
import { api } from './client';

/** Ways an account can sign in. */
export type SignInMethod = 'password' | 'google';

export interface User {
  id: string;
  name: string;
  email: string;
  /**
   * Missing from profiles cached by older versions and from older servers;
   * those accounts all have a password (see `signInMethodsOf`).
   */
  signInMethods?: SignInMethod[];
  /**
   * Whether the address is confirmed. Missing from older servers and cached
   * profiles: the sync answer is what really decides (see syncSlice).
   */
  emailVerified?: boolean;
  createdAt: string;
}

export const signInMethodsOf = (
  user: User | null | undefined,
): SignInMethod[] => user?.signInMethods ?? ['password'];

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  name: string;
}

export interface GoogleSignIn {
  /** From Google's account chooser (services/googleSignIn.ts). */
  idToken: string;
  /** Only to connect Google to an existing email/password account. */
  password?: string;
}

/** How the user confirms that they really want their account deleted. */
export type DeletionConfirmation =
  | { password: string }
  /** A fresh token from choosing the account's Google account again. */
  | { googleIdToken: string };

export const authApi = {
  register: (body: Registration) =>
    api.post<AuthResponse>('/auth/register', body).then(r => r.data),

  login: (body: Credentials) =>
    api.post<AuthResponse>('/auth/login', body).then(r => r.data),

  /** Signs in, or signs up the first time, with Google. */
  google: (body: GoogleSignIn) =>
    api.post<AuthResponse>('/auth/google', body).then(r => r.data),

  logout: (refreshToken: string) =>
    api.post<void>('/auth/logout', { refreshToken }),

  me: () => api.get<User>('/auth/me').then(r => r.data),

  /** Emails a password reset link, if the address has an account. */
  forgotPassword: (email: string) =>
    api.post<void>('/auth/password/forgot', { email }),

  /** Emails a new link to confirm the signed-in user's address. */
  resendVerification: () => api.post<void>('/auth/verify-email/resend'),

  /** Permanently deletes the account and all its tasks. */
  deleteAccount: (confirmation: DeletionConfirmation) =>
    api.delete<void>('/auth/me', { data: confirmation }),
};
