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
