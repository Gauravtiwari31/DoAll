import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotImplementedException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../common/interfaces/jwt-payload.interface';
import { sha256 } from '../common/utils/hash';
import { VERIFY_EMAIL_PATH, RESET_PASSWORD_PATH } from '../legal/legal.constants';
import { Mail, MailService } from '../mail/mail.service';
import { TasksService } from '../tasks/tasks.service';
import {
  isEmailVerified,
  PublicUser,
  RefreshSession,
  toPublicUser,
  UserDocument,
} from '../users/schemas/user.schema';
import { EmailTokenKind, UsersService } from '../users/users.service';
import { passwordResetEmail, verificationEmail } from './auth.emails';
import { AuthResponse, AuthTokens, GOOGLE_LINK_PASSWORD_REQUIRED } from './auth.types';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { GoogleSignInDto } from './dto/google-sign-in.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  GoogleIdentity,
  GoogleIdentityService,
  InvalidGoogleTokenError,
} from './google-identity.service';

/** bcrypt work factor: ~100ms per hash — slow for attackers, fine for users. */
const BCRYPT_ROUNDS = 10;
/** Max simultaneous signed-in devices per account; the oldest session is evicted. */
const MAX_SESSIONS = 5;
/** Same limit as RegisterDto and the schema. */
const MAX_NAME_LENGTH = 50;
/** How long the links in emails work. */
const VERIFY_LINK_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const RESET_LINK_TTL_MS = 60 * 60 * 1000;

const MAIL_OFF =
  "This server can't send emails. Ask whoever runs it, or email the address in the privacy policy.";

type Ttl = JwtSignOptions['expiresIn'];

const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === 11000;

/**
 * The name for an account created with Google: Google's display name, or the
 * part of the email address before the @ when Google has none.
 */
const nameFromGoogle = ({ name, email }: GoogleIdentity) =>
  // Array.from splits by code point, so an emoji is never cut in half.
  Array.from(name ?? email.split('@')[0])
    .slice(0, MAX_NAME_LENGTH)
    .join('');

/**
 * Authentication flow
 * -------------------
 * - Short-lived **access token** (default 15 min) authorises API calls.
 * - Long-lived **refresh token** (default 30 days) is exchanged for a fresh
 *   pair via `/auth/refresh`. Tokens are **rotated** on every refresh.
 * - Only a SHA-256 of each refresh token is stored. If a token that was
 *   already rotated is presented again, it has likely been stolen, so every
 *   session of that user is revoked (refresh-token reuse detection).
 * - Accounts sign in with a password, with Google, or with both. Either way
 *   they then get the same token pair.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly tasks: TasksService,
    private readonly google: GoogleIdentityService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Whether sync waits for a confirmed email address. Only when the server
   * can send the verification email; otherwise nobody could ever confirm.
   */
  get emailVerificationRequired(): boolean {
    return this.mail.enabled;
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    let user: UserDocument;
    try {
      user = await this.users.create({ name: dto.name, email: dto.email, passwordHash });
    } catch (error) {
      // Two concurrent sign-ups with the same email: the unique index wins.
      if (isDuplicateKey(error)) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }

    // Sign-up doesn't wait for the email, and doesn't fail when it can't be sent:
    // the app offers "Resend" until the address is confirmed.
    if (this.mail.enabled) {
      void this.sendEmailLink(user, 'verify').catch((error: Error) =>
        this.logger.warn(`Couldn't send the verification email to ${user.id}: ${error.message}`),
      );
    }
    return this.startSession(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.verifyCredentials(dto.email, dto.password);
    return this.startSession(user);
  }

  /**
   * Sign in with a Google ID token from the app. The first time creates the
   * account, named and addressed as on Google.
   *
   * If an email/password account already uses the address, Google is only
   * connected to it once its password has been given as well. Otherwise
   * someone could sign up with another person's email address before they
   * ever use DoAll, wait for them to sign in with Google, and keep access
   * through the password ("account pre-hijacking").
   */
  async signInWithGoogle({ idToken, password }: GoogleSignInDto): Promise<AuthResponse> {
    const google = await this.verifyGoogleToken(
      idToken,
      (message) => new UnauthorizedException(message),
    );

    const linked = await this.users.findByGoogleIdWithSecrets(google.id);
    if (linked) return this.startSession(linked);

    if (!google.emailVerified) {
      throw new UnauthorizedException(
        "Your Google account's email address isn't verified, so it can't be used to sign in.",
      );
    }

    const existing = await this.users.findByEmailWithSecrets(google.email);
    if (existing) return this.connectGoogle(existing, google, password);

    let user: UserDocument;
    try {
      user = await this.users.create({
        name: nameFromGoogle(google),
        email: google.email,
        googleId: google.id,
      });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      // The same sign-in arrived twice at once, and the other one won.
      const raced = await this.users.findByGoogleIdWithSecrets(google.id);
      if (!raced) throw new ConflictException('An account with this email already exists');
      user = raced;
    }
    return this.startSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.users.findByIdWithSecrets(payload.sub);
    if (!user) throw new UnauthorizedException('Session expired, please sign in again');

    const tokenHash = sha256(refreshToken);
    const current = user.sessions.find((s) => s.tokenHash === tokenHash);
    if (!current) {
      // Valid signature but unknown token => it was already rotated or revoked.
      this.logger.warn(`Refresh token reuse detected for user ${user.id}; revoking all sessions`);
      await this.users.replaceSessions(user.id as string, []);
      throw new UnauthorizedException('Session expired, please sign in again');
    }

    const remaining = user.sessions.filter((s) => s.tokenHash !== tokenHash);
    const tokens = await this.issueTokens(user, remaining);
    return { user: toPublicUser(user), tokens };
  }

  /** Revokes a single session. Idempotent: unknown / expired tokens are ignored. */
  async logout(refreshToken: string): Promise<void> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        ignoreExpiration: true,
      });
    } catch {
      return;
    }
    const user = await this.users.findByIdWithSessions(payload.sub);
    if (!user) return;
    const tokenHash = sha256(refreshToken);
    await this.users.replaceSessions(
      user.id as string,
      user.sessions.filter((s) => s.tokenHash !== tokenHash),
    );
  }

  /** Sends a new verification email to the signed-in user. A no-op once confirmed. */
  async resendVerification(userId: string): Promise<void> {
    if (!this.mail.enabled) throw new NotImplementedException(MAIL_OFF);
    const user = await this.users.findByIdWithSecrets(userId);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (isEmailVerified(user)) return;
    await this.sendOrFail(user, 'verify');
  }

  /**
   * The verification link was opened. Returns the confirmed address, or null
   * when the link is unknown, used or expired.
   */
  async verifyEmail(token: string): Promise<string | null> {
    const user = await this.users.findByEmailToken('verify', sha256(token));
    if (!user) return null;
    await this.users.markEmailVerified(user.id as string);
    this.logger.log(`Email confirmed for account ${user.id}`);
    return user.email;
  }

  /**
   * Emails a password reset link. Says nothing about whether the address has
   * an account, so it can't be used to find out who uses DoAll.
   */
  async requestPasswordReset(email: string): Promise<void> {
    if (!this.mail.enabled) throw new NotImplementedException(MAIL_OFF);
    const user = await this.users.findByEmail(email);
    if (!user) return;
    try {
      await this.sendEmailLink(user, 'reset');
    } catch (error) {
      // Logged, not reported: the answer must look the same as for an unknown address.
      this.logger.warn(
        `Couldn't send a password reset email to ${user.id}: ${(error as Error).message}`,
      );
    }
  }

  /** Whether a reset link still works, so the page can say so before asking for a password. */
  async isPasswordResetTokenValid(token: string): Promise<boolean> {
    return (await this.users.findByEmailToken('reset', sha256(token))) !== null;
  }

  /**
   * Sets a new password from a reset link (the password has been checked
   * already) and signs out every device. Returns the account's address, or
   * null when the link is unknown, used or expired.
   */
  async resetPassword(token: string, password: string): Promise<string | null> {
    const tokenHash = sha256(token);
    const user = await this.users.findByEmailToken('reset', tokenHash);
    if (!user) return null;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    if (!(await this.users.resetPassword(user.id as string, tokenHash, passwordHash))) return null;
    this.logger.log(`Password reset for account ${user.id}; all sessions revoked`);
    return user.email;
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findByIdWithSecrets(userId);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return toPublicUser(user);
  }

  /**
   * Permanently deletes the signed-in user's account once they confirm who
   * they are again: with the password or, for an account that signs in with
   * Google, by choosing that Google account again (a fresh ID token).
   */
  async deleteAccount(
    userId: string,
    { password, googleIdToken }: DeleteAccountDto,
  ): Promise<void> {
    const user = await this.users.findByIdWithSecrets(userId);
    if (!user) throw new UnauthorizedException('Account no longer exists');

    // 403, not 401: the app reads 401 as "access token expired" and would refresh and retry.
    if (googleIdToken !== undefined) {
      const google = await this.verifyGoogleToken(
        googleIdToken,
        (message) => new ForbiddenException(message),
      );
      if (google.id !== user.googleId) {
        throw new ForbiddenException(
          "That Google account isn't the one connected to your DoAll account. Choose the one you sign in with.",
        );
      }
    } else if (!user.passwordHash) {
      throw new ForbiddenException(
        'Your account signs in with Google. Confirm with Google instead.',
      );
    } else if (!(await bcrypt.compare(password ?? '', user.passwordHash))) {
      throw new ForbiddenException('Incorrect password');
    }
    await this.removeAccount(user.id as string);
  }

  /** Same deletion for the public web form, where the user proves who they are like at login. */
  async deleteAccountWithCredentials(email: string, password: string): Promise<void> {
    const user = await this.verifyCredentials(email, password);
    await this.removeAccount(user.id as string);
  }

  /**
   * Deletion from the web page after the person chose a Google account there:
   * the DoAll account connected to that Google account or, failing that, the
   * one registered with its email address once Google has verified it.
   * Proving that you own an address is enough to delete its account, though
   * not to sign in to it. Returns the deleted account's email, or null if
   * there was none.
   */
  async deleteAccountWithGoogle(google: GoogleIdentity): Promise<string | null> {
    let user = await this.users.findByGoogleId(google.id);
    if (!user && google.emailVerified) {
      const byEmail = await this.users.findByEmail(google.email);
      // An account connected to a different Google account isn't theirs to delete.
      if (byEmail && !byEmail.googleId) user = byEmail;
    }
    if (!user) return null;
    await this.removeAccount(user.id as string);
    return user.email;
  }

  // ---------------------------------------------------------------------------

  private async verifyCredentials(email: string, password: string): Promise<UserDocument> {
    const user = await this.users.findByEmailWithSecrets(email);
    if (user && !user.passwordHash) {
      // Created with Google: there is no password to check against.
      throw new UnauthorizedException(
        'This account signs in with Google. Use "Continue with Google" instead.',
      );
    }
    // Same message for "no such user" and "wrong password" to avoid leaking which emails exist.
    const valid = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new UnauthorizedException('Incorrect email or password');
    }
    return user;
  }

  /**
   * Checks a Google ID token sent by the app. A token Google didn't issue for
   * this app turns into `rejection(message)`: 401 when signing in, 403 when it
   * confirms an action of a signed-in user.
   */
  private async verifyGoogleToken(
    idToken: string,
    rejection: (message: string) => HttpException,
  ): Promise<GoogleIdentity> {
    if (!this.google.enabled) {
      throw new NotImplementedException("Google sign-in isn't set up on this server.");
    }
    try {
      return await this.google.verifyIdToken(idToken);
    } catch (error) {
      if (error instanceof InvalidGoogleTokenError) {
        throw rejection("Google couldn't confirm your account. Please try again.");
      }
      throw error;
    }
  }

  /** Connects Google to an existing email/password account (see signInWithGoogle). */
  private async connectGoogle(
    user: UserDocument,
    google: GoogleIdentity,
    password: string | undefined,
  ): Promise<AuthResponse> {
    if (user.googleId) {
      throw new ConflictException(
        'This email address is already connected to a different Google account.',
      );
    }
    if (password === undefined) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: GOOGLE_LINK_PASSWORD_REQUIRED,
        message:
          'You already have a DoAll account with this email. Enter its password once to connect Google sign-in.',
        email: user.email,
      });
    }
    // 403 like the other "confirm with your password" checks.
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ForbiddenException('Incorrect password');
    }

    let linked: boolean;
    try {
      linked = await this.users.linkGoogleAccount(user.id as string, google.id);
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      linked = false; // that Google account was connected to another account meanwhile
    }
    if (!linked) {
      throw new ConflictException('This account changed in the meantime. Please try again.');
    }
    user.googleId = google.id;
    this.logger.log(`Connected Google sign-in to account ${user.id}`);
    return this.startSession(user);
  }

  /** Emails a fresh link of the given kind; the previous one stops working. */
  private async sendEmailLink(user: UserDocument, kind: EmailTokenKind): Promise<void> {
    const publicUrl = this.config.get<string | null>('publicUrl');
    if (!publicUrl) throw new Error('PUBLIC_URL is not set');
    const token = randomBytes(32).toString('base64url');
    const ttl = kind === 'verify' ? VERIFY_LINK_TTL_MS : RESET_LINK_TTL_MS;
    await this.users.setEmailToken(
      user.id as string,
      kind,
      sha256(token),
      new Date(Date.now() + ttl),
    );

    const path = kind === 'verify' ? VERIFY_EMAIL_PATH : RESET_PASSWORD_PATH;
    const link = `${publicUrl}/${path}?token=${token}`;
    const mail: Mail =
      kind === 'verify'
        ? verificationEmail(user.email, user.name, link)
        : passwordResetEmail(user.email, user.name, link);
    await this.mail.send(mail);
  }

  /** Like sendEmailLink, for requests that should tell the user when sending failed. */
  private async sendOrFail(user: UserDocument, kind: EmailTokenKind): Promise<void> {
    try {
      await this.sendEmailLink(user, kind);
    } catch (error) {
      this.logger.error(`Couldn't send a ${kind} email to ${user.id}: ${(error as Error).message}`);
      throw new ServiceUnavailableException("The email couldn't be sent. Please try again later.");
    }
  }

  /** Issues a token pair for a user loaded with its secrets (or just created). */
  private async startSession(user: UserDocument): Promise<AuthResponse> {
    const tokens = await this.issueTokens(user, user.sessions ?? []);
    return { user: toPublicUser(user), tokens };
  }

  /**
   * Tasks go first: if that step fails the account still exists and the user
   * can simply try again, rather than leaving tasks behind that nobody owns.
   * Deleting the user document also drops every refresh session.
   */
  private async removeAccount(userId: string): Promise<void> {
    const deletedTasks = await this.tasks.removeAllForOwner(userId);
    await this.users.deleteById(userId);
    this.logger.log(`Deleted account ${userId} and its ${deletedTasks} task(s)`);
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Session expired, please sign in again');
    }
  }

  /** Signs a new access/refresh pair and persists the refresh session. */
  private async issueTokens(user: UserDocument, existing: RefreshSession[]): Promise<AuthTokens> {
    const userId = user.id as string;
    const accessPayload: AccessTokenPayload = { sub: userId, email: user.email };
    const refreshPayload: RefreshTokenPayload = { sub: userId, jti: randomUUID() };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.config.getOrThrow<string>('jwt.accessTtl') as Ttl,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.config.getOrThrow<string>('jwt.refreshTtl') as Ttl,
      }),
    ]);

    const now = Date.now();
    const session: RefreshSession = {
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(this.expiryOf(refreshToken)),
      createdAt: new Date(now),
    };
    // Drop expired sessions, append the new one, keep the newest MAX_SESSIONS.
    const sessions = [...existing.filter((s) => s.expiresAt.getTime() > now), session].slice(
      -MAX_SESSIONS,
    );
    await this.users.replaceSessions(userId, sessions);

    const { iat, exp } = this.jwt.decode<{ iat: number; exp: number }>(accessToken);
    return { accessToken, refreshToken, expiresIn: exp - iat };
  }

  /** Reads the `exp` claim (seconds) of a token we just signed and returns ms. */
  private expiryOf(token: string): number {
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return exp * 1000;
  }
}
