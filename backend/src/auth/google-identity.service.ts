import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { gaxios, OAuth2Client, TokenPayload } from 'google-auth-library';

/** Who someone is, according to an ID token that Google signed for this app. */
export interface GoogleIdentity {
  /** Google's permanent account ID (`sub`). The email can change; this never does. */
  id: string;
  email: string;
  /** Google has confirmed that the person controls `email`. */
  emailVerified: boolean;
  name: string | null;
}

/** Not a valid Google ID token for this app: forged, expired, or issued to another client. */
export class InvalidGoogleTokenError extends Error {}

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

/**
 * Talks to Google for "Sign in with Google", using Google's own library.
 *
 * - The app gets an ID token from Google on the phone (Credential Manager)
 *   and sends it here; `verifyIdToken` checks it. Only the client ID is needed.
 * - The web account deletion page uses the browser flow instead: Google sends
 *   back a one-time code that `exchangeCode` trades for an ID token, which
 *   needs the client secret as well.
 */
@Injectable()
export class GoogleIdentityService {
  private readonly logger = new Logger(GoogleIdentityService.name);
  private readonly clientId: string | null;
  private readonly clientSecret: string | null;
  private readonly client: OAuth2Client;

  constructor(config: ConfigService) {
    this.clientId = config.get<string | null>('google.clientId') ?? null;
    this.clientSecret = config.get<string | null>('google.clientSecret') ?? null;
    this.client = new OAuth2Client({
      clientId: this.clientId ?? undefined,
      clientSecret: this.clientSecret ?? undefined,
    });
  }

  /** Sign-in from the app works once the client ID is set. */
  get enabled(): boolean {
    return this.clientId !== null;
  }

  /** The browser flow (account deletion page) also needs the client secret. */
  get webEnabled(): boolean {
    return this.clientId !== null && this.clientSecret !== null;
  }

  /**
   * Checks Google's signature, the issuer and expiry, and that the token was
   * issued to this app's client ID. With `nonce` (browser flow), also that it
   * answers that particular sign-in request.
   */
  async verifyIdToken(idToken: string, nonce?: string): Promise<GoogleIdentity> {
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.requireClientId() });
      payload = ticket.getPayload();
    } catch (error) {
      throw this.translate(error);
    }
    if (!payload?.sub || !payload.email) {
      throw new InvalidGoogleTokenError('The token has no account ID or email address');
    }
    if (nonce !== undefined && payload.nonce !== nonce) {
      throw new InvalidGoogleTokenError('The token answers a different sign-in request');
    }
    return {
      id: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name?.trim() || payload.given_name?.trim() || null,
    };
  }

  /** Google's account chooser, which sends the browser back to `redirectUri` (browser flow). */
  authorizationUrl({
    redirectUri,
    state,
    nonce,
  }: {
    redirectUri: string;
    state: string;
    nonce: string;
  }): string {
    const params = new URLSearchParams({
      client_id: this.requireClientId(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state,
      nonce,
      // Always ask which account, even when only one is signed in to Google.
      prompt: 'select_account',
    });
    return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
  }

  /** Trades the code Google sent back for an ID token and verifies it (browser flow). */
  async exchangeCode(code: string, redirectUri: string, nonce: string): Promise<GoogleIdentity> {
    let idToken: string | null | undefined;
    try {
      const { tokens } = await this.client.getToken({ code, redirect_uri: redirectUri });
      idToken = tokens.id_token;
    } catch (error) {
      throw this.translate(error);
    }
    if (!idToken) {
      throw new InvalidGoogleTokenError('Google returned no ID token');
    }
    return this.verifyIdToken(idToken, nonce);
  }

  private requireClientId(): string {
    if (!this.clientId) {
      throw new Error('Google sign-in is not configured: set GOOGLE_CLIENT_ID');
    }
    return this.clientId;
  }

  /**
   * Google answering "no" means the token or code was bad. Not reaching
   * Google, or Google refusing this server's own credentials, is our problem
   * (503). The library's messages can contain the token, so they aren't logged.
   */
  private translate(error: unknown): Error {
    if (!(error instanceof gaxios.GaxiosError)) {
      return new InvalidGoogleTokenError('Invalid Google ID token');
    }
    const reason = (error.response?.data as { error?: unknown } | undefined)?.error;
    if (reason === 'invalid_client' || reason === 'unauthorized_client') {
      this.logger.error(
        `Google refused this server's OAuth client (${reason}): check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET`,
      );
      return new ServiceUnavailableException(
        'Google sign-in is not set up correctly on this server.',
      );
    }
    if (error.status !== undefined && error.status >= 400 && error.status < 500) {
      return new InvalidGoogleTokenError(
        `Google refused the request (${typeof reason === 'string' ? reason : error.status})`,
      );
    }
    this.logger.warn(
      `Couldn't reach Google (${String(error.code ?? error.status ?? 'no response')})`,
    );
    return new ServiceUnavailableException(
      "Couldn't reach Google to check the sign-in. Please try again in a moment.",
    );
  }
}
