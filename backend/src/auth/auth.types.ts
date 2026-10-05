import { PublicUser } from '../users/schemas/user.schema';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /**
   * Access token lifetime in seconds (OAuth 2 style). Relative rather than an
   * absolute timestamp so clients with a skewed clock still refresh on time.
   */
  expiresIn: number;
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
}

/**
 * `code` of the 409 from POST /auth/google when an email/password account
 * already uses the Google account's address: send the request again with
 * that account's `password` to connect the two.
 */
export const GOOGLE_LINK_PASSWORD_REQUIRED = 'GOOGLE_LINK_PASSWORD_REQUIRED';
