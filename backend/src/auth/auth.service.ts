import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../common/interfaces/jwt-payload.interface';
import { sha256 } from '../common/utils/hash';
import {
  PublicUser,
  RefreshSession,
  toPublicUser,
  UserDocument,
} from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthResponse, AuthTokens } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/** bcrypt work factor: ~100ms per hash — slow for attackers, fine for users. */
const BCRYPT_ROUNDS = 10;
/** Max simultaneous signed-in devices per account; the oldest session is evicted. */
const MAX_SESSIONS = 5;

type Ttl = JwtSignOptions['expiresIn'];

/**
 * Authentication flow
 * -------------------
 * - Short-lived **access token** (default 15 min) authorises API calls.
 * - Long-lived **refresh token** (default 30 days) is exchanged for a fresh
 *   pair via `/auth/refresh`. Tokens are **rotated** on every refresh.
 * - Only a SHA-256 of each refresh token is stored. If a token that was
 *   already rotated is presented again, it has likely been stolen, so every
 *   session of that user is revoked (refresh-token reuse detection).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

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
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }

    const tokens = await this.issueTokens(user, []);
    return { user: toPublicUser(user), tokens };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmailWithSecrets(dto.email);
    // Same message for "no such user" and "wrong password" to avoid leaking which emails exist.
    const valid = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    const tokens = await this.issueTokens(user, user.sessions);
    return { user: toPublicUser(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.users.findByIdWithSessions(payload.sub);
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

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return toPublicUser(user);
  }

  // ---------------------------------------------------------------------------

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
