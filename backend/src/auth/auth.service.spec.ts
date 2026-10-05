import {
  ConflictException,
  ForbiddenException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { sha256 } from '../common/utils/hash';
import { Mail, MailService } from '../mail/mail.service';
import { TasksService } from '../tasks/tasks.service';
import { RefreshSession } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { GOOGLE_LINK_PASSWORD_REQUIRED } from './auth.types';
import {
  GoogleIdentity,
  GoogleIdentityService,
  InvalidGoogleTokenError,
} from './google-identity.service';

/** Minimal in-memory stand-in for a hydrated user document. */
const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: '64b000000000000000000001',
  name: 'Ada',
  email: 'ada@example.com',
  passwordHash: bcrypt.hashSync('secret123', 4),
  sessions: [] as RefreshSession[],
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

/** What Google says about the person who chose an account. */
const googleAda: GoogleIdentity = {
  id: 'google-sub-ada',
  email: 'ada@example.com',
  emailVerified: true,
  name: 'Ada Lovelace',
};

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersService>;
  let google: { enabled: boolean; verifyIdToken: jest.Mock };
  let savedSessions: RefreshSession[];
  // Held separately so assertions don't pass unbound methods around.
  let deleteUser: jest.Mock;
  let deleteTasks: jest.Mock;
  let createUser: jest.Mock;
  let linkGoogle: jest.Mock;
  let markVerified: jest.Mock;
  let mail: { enabled: boolean; send: jest.Mock };
  /** Emailed tokens by kind, as UsersService.setEmailToken stored their hashes. */
  let emailTokens: Record<string, string>;

  beforeEach(async () => {
    markVerified = jest.fn().mockResolvedValue(undefined);
    mail = { enabled: false, send: jest.fn().mockResolvedValue(undefined) };
    emailTokens = {};
    savedSessions = [];
    deleteUser = jest.fn().mockResolvedValue(undefined);
    deleteTasks = jest.fn().mockResolvedValue(3);
    createUser = jest.fn((data: Record<string, unknown>) =>
      // A new document has no password hash unless one was given.
      Promise.resolve(makeUser({ passwordHash: undefined, ...data })),
    );
    linkGoogle = jest.fn().mockResolvedValue(true);
    users = {
      create: createUser,
      findByEmail: jest.fn().mockResolvedValue(null),
      findByEmailWithSecrets: jest.fn().mockResolvedValue(null),
      findByGoogleId: jest.fn().mockResolvedValue(null),
      findByGoogleIdWithSecrets: jest.fn().mockResolvedValue(null),
      findByIdWithSecrets: jest.fn(),
      findByIdWithSessions: jest.fn(),
      linkGoogleAccount: linkGoogle,
      replaceSessions: jest.fn((_id: string, sessions: RefreshSession[]) => {
        savedSessions = sessions;
        return Promise.resolve();
      }),
      deleteById: deleteUser,
      setEmailToken: jest.fn((_id: string, kind: string, hash: string) => {
        emailTokens[kind] = hash;
        return Promise.resolve();
      }),
      findByEmailToken: jest.fn((kind: string, hash: string) =>
        Promise.resolve(emailTokens[kind] === hash ? makeUser() : null),
      ),
      markEmailVerified: markVerified,
      resetPassword: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<UsersService>;
    const tasks = { removeAllForOwner: deleteTasks } as unknown as TasksService;
    // A token is "valid" when it names a GoogleIdentity registered here.
    google = {
      enabled: true,
      verifyIdToken: jest.fn((token: string) =>
        token === 'token-ada'
          ? Promise.resolve(googleAda)
          : Promise.reject(new InvalidGoogleTokenError('bad token')),
      ),
    };

    const config = {
      get: (key: string) => (key === 'publicUrl' ? 'https://doall.example.com' : undefined),
      getOrThrow: (key: string) =>
        ({
          'jwt.accessSecret': 'a'.repeat(32),
          'jwt.refreshSecret': 'r'.repeat(32),
          'jwt.accessTtl': '15m',
          'jwt.refreshTtl': '30d',
        })[key],
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: UsersService, useValue: users },
        { provide: TasksService, useValue: tasks },
        { provide: GoogleIdentityService, useValue: google },
        { provide: MailService, useValue: mail },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('registers a user with a hashed password and returns tokens', async () => {
    const result = await service.register({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'secret123',
    });

    const created = createUser.mock.calls[0][0] as { passwordHash: string };
    expect(created.passwordHash).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', created.passwordHash)).toBe(true);
    expect(result.user).toEqual(
      expect.objectContaining({ email: 'ada@example.com', signInMethods: ['password'] }),
    );
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(savedSessions).toHaveLength(1);
    expect(savedSessions[0].tokenHash).toBe(sha256(result.tokens.refreshToken));
  });

  it('rejects duplicate emails', async () => {
    users.findByEmail.mockResolvedValue(makeUser() as never);
    await expect(
      service.register({ name: 'Ada', email: 'ada@example.com', password: 'secret123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a wrong password with a generic message', async () => {
    users.findByEmailWithSecrets.mockResolvedValue(makeUser() as never);
    await expect(service.login({ email: 'ada@example.com', password: 'nope1234' })).rejects.toThrow(
      new UnauthorizedException('Incorrect email or password'),
    );
  });

  it('points accounts without a password to Google at login', async () => {
    users.findByEmailWithSecrets.mockResolvedValue(
      makeUser({ passwordHash: undefined, googleId: googleAda.id }) as never,
    );
    await expect(
      service.login({ email: 'ada@example.com', password: 'secret123' }),
    ).rejects.toThrow(/signs in with Google/);
  });

  it('rotates refresh tokens and revokes everything on reuse', async () => {
    users.findByEmailWithSecrets.mockResolvedValue(makeUser() as never);
    const { tokens } = await service.login({ email: 'ada@example.com', password: 'secret123' });

    // First use: valid, rotated.
    users.findByIdWithSecrets.mockResolvedValue(makeUser({ sessions: savedSessions }) as never);
    const rotated = await service.refresh(tokens.refreshToken);
    expect(rotated.tokens.refreshToken).not.toBe(tokens.refreshToken);
    expect(savedSessions.map((s) => s.tokenHash)).toEqual([sha256(rotated.tokens.refreshToken)]);

    // Second use of the old token: treated as theft.
    users.findByIdWithSecrets.mockResolvedValue(makeUser({ sessions: savedSessions }) as never);
    await expect(service.refresh(tokens.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(savedSessions).toEqual([]);
  });

  it('caps the number of concurrent sessions', async () => {
    let sessions: RefreshSession[] = [];
    for (let i = 0; i < 7; i++) {
      users.findByEmailWithSecrets.mockResolvedValue(makeUser({ sessions }) as never);
      await service.login({ email: 'ada@example.com', password: 'secret123' });
      sessions = savedSessions;
    }
    expect(sessions).toHaveLength(5);
  });

  it('reports how the account signs in', async () => {
    users.findByIdWithSecrets.mockResolvedValue(makeUser({ googleId: googleAda.id }) as never);
    expect((await service.me('64b000000000000000000001')).signInMethods).toEqual([
      'password',
      'google',
    ]);
  });

  describe('Google sign-in', () => {
    it('creates an account named after the Google account the first time', async () => {
      const result = await service.signInWithGoogle({ idToken: 'token-ada' });

      expect(createUser).toHaveBeenCalledWith({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        googleId: 'google-sub-ada',
      });
      expect(result.user).toEqual(
        expect.objectContaining({ email: 'ada@example.com', signInMethods: ['google'] }),
      );
      expect(savedSessions).toHaveLength(1);
    });

    it('names an account without a Google name after the email address', async () => {
      google.verifyIdToken.mockResolvedValue({ ...googleAda, name: null });
      await service.signInWithGoogle({ idToken: 'token-ada' });
      expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'ada' }));
    });

    it('signs in to the account already connected to that Google account', async () => {
      users.findByGoogleIdWithSecrets.mockResolvedValue(
        makeUser({ passwordHash: undefined, googleId: googleAda.id }) as never,
      );

      const result = await service.signInWithGoogle({ idToken: 'token-ada' });

      expect(result.user.id).toBe('64b000000000000000000001');
      expect(createUser).not.toHaveBeenCalled();
    });

    it('refuses tokens Google did not issue for this app, and unverified emails', async () => {
      await expect(service.signInWithGoogle({ idToken: 'forged' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      google.verifyIdToken.mockResolvedValue({ ...googleAda, emailVerified: false });
      await expect(service.signInWithGoogle({ idToken: 'token-ada' })).rejects.toThrow(
        /isn't verified/,
      );
      expect(createUser).not.toHaveBeenCalled();
    });

    it('answers 501 when the server has no Google client ID', async () => {
      google.enabled = false;
      await expect(service.signInWithGoogle({ idToken: 'token-ada' })).rejects.toBeInstanceOf(
        NotImplementedException,
      );
    });

    it('asks for the password before connecting Google to an existing account', async () => {
      users.findByEmailWithSecrets.mockResolvedValue(makeUser() as never);

      const error = await service
        .signInWithGoogle({ idToken: 'token-ada' })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ code: GOOGLE_LINK_PASSWORD_REQUIRED, email: 'ada@example.com' }),
      );

      await expect(
        service.signInWithGoogle({ idToken: 'token-ada', password: 'nope1234' }),
      ).rejects.toThrow(new ForbiddenException('Incorrect password'));
      expect(linkGoogle).not.toHaveBeenCalled();

      const result = await service.signInWithGoogle({
        idToken: 'token-ada',
        password: 'secret123',
      });
      expect(linkGoogle).toHaveBeenCalledWith('64b000000000000000000001', 'google-sub-ada');
      expect(result.user.signInMethods).toEqual(['password', 'google']);
      expect(createUser).not.toHaveBeenCalled();
    });

    it('never connects a second Google account to an account', async () => {
      users.findByEmailWithSecrets.mockResolvedValue(
        makeUser({ googleId: 'someone-else' }) as never,
      );
      await expect(
        service.signInWithGoogle({ idToken: 'token-ada', password: 'secret123' }),
      ).rejects.toThrow(/different Google account/);
      expect(linkGoogle).not.toHaveBeenCalled();
    });
  });

  describe('account deletion', () => {
    const userId = '64b000000000000000000001';

    it('deletes the tasks first, then the user, once the password is confirmed', async () => {
      users.findByIdWithSecrets.mockResolvedValue(makeUser() as never);

      await service.deleteAccount(userId, { password: 'secret123' });

      expect(deleteTasks).toHaveBeenCalledWith(userId);
      expect(deleteUser).toHaveBeenCalledWith(userId);
      expect(deleteTasks.mock.invocationCallOrder[0]).toBeLessThan(
        deleteUser.mock.invocationCallOrder[0],
      );
    });

    it('answers a wrong password with 403 (not 401) and deletes nothing', async () => {
      users.findByIdWithSecrets.mockResolvedValue(makeUser() as never);

      await expect(service.deleteAccount(userId, { password: 'nope1234' })).rejects.toThrow(
        new ForbiddenException('Incorrect password'),
      );
      expect(deleteTasks).not.toHaveBeenCalled();
      expect(deleteUser).not.toHaveBeenCalled();
    });

    it('treats an account that is already gone as signed out', async () => {
      users.findByIdWithSecrets.mockResolvedValue(null);

      await expect(service.deleteAccount(userId, { password: 'secret123' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(deleteUser).not.toHaveBeenCalled();
    });

    it('confirms a Google account by choosing the same Google account again', async () => {
      users.findByIdWithSecrets.mockResolvedValue(
        makeUser({ passwordHash: undefined, googleId: 'another-google-account' }) as never,
      );
      await expect(service.deleteAccount(userId, { googleIdToken: 'token-ada' })).rejects.toThrow(
        /isn't the one connected/,
      );
      await expect(
        service.deleteAccount(userId, { googleIdToken: 'forged' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.deleteAccount(userId, { password: 'secret123' })).rejects.toThrow(
        /Confirm with Google/,
      );
      expect(deleteUser).not.toHaveBeenCalled();

      users.findByIdWithSecrets.mockResolvedValue(
        makeUser({ passwordHash: undefined, googleId: googleAda.id }) as never,
      );
      await service.deleteAccount(userId, { googleIdToken: 'token-ada' });
      expect(deleteUser).toHaveBeenCalledWith(userId);
    });

    it('deletes by email and password for the web form, checking them like login', async () => {
      users.findByEmailWithSecrets.mockResolvedValue(makeUser() as never);
      await expect(
        service.deleteAccountWithCredentials('ada@example.com', 'nope1234'),
      ).rejects.toThrow(new UnauthorizedException('Incorrect email or password'));
      expect(deleteUser).not.toHaveBeenCalled();

      await service.deleteAccountWithCredentials('ada@example.com', 'secret123');
      expect(deleteTasks).toHaveBeenCalledWith(userId);
      expect(deleteUser).toHaveBeenCalledWith(userId);
    });

    describe('from the web page, with Google', () => {
      it('deletes the account connected to the Google account', async () => {
        users.findByGoogleId.mockResolvedValue(makeUser({ googleId: googleAda.id }) as never);
        expect(await service.deleteAccountWithGoogle(googleAda)).toBe('ada@example.com');
        expect(deleteUser).toHaveBeenCalledWith(userId);
      });

      it('falls back to an unconnected account with the verified email address', async () => {
        users.findByEmail.mockResolvedValue(makeUser() as never);
        expect(await service.deleteAccountWithGoogle(googleAda)).toBe('ada@example.com');
        expect(deleteUser).toHaveBeenCalledWith(userId);
      });

      it('leaves alone accounts that are not provably theirs', async () => {
        users.findByEmail.mockResolvedValue(makeUser({ googleId: 'someone-else' }) as never);
        expect(await service.deleteAccountWithGoogle(googleAda)).toBeNull();

        users.findByEmail.mockResolvedValue(makeUser() as never);
        expect(
          await service.deleteAccountWithGoogle({ ...googleAda, emailVerified: false }),
        ).toBeNull();
        expect(deleteUser).not.toHaveBeenCalled();
      });
    });
  });

  describe('email links', () => {
    /** The token in the link of the last email sent. */
    const lastLinkToken = () => {
      const sent = mail.send.mock.calls.at(-1)?.[0] as Mail;
      return /token=([\w-]+)/.exec(sent.text)?.[1] as string;
    };

    beforeEach(() => {
      mail.enabled = true;
    });

    it('emails a verification link on sign-up, and the link confirms the address', async () => {
      await service.register({ name: 'Ada', email: 'ada@example.com', password: 'secret123' });
      await new Promise(setImmediate); // sign-up doesn't wait for the email

      const sent = mail.send.mock.calls[0][0] as Mail;
      expect(sent.to).toBe('ada@example.com');
      expect(sent.text).toContain('https://doall.example.com/verify-email?token=');
      expect(emailTokens.verify).toBe(sha256(lastLinkToken()));

      expect(await service.verifyEmail(lastLinkToken())).toBe('ada@example.com');
      expect(markVerified).toHaveBeenCalledWith('64b000000000000000000001');
      expect(await service.verifyEmail('not-the-token')).toBeNull();
    });

    it("doesn't send anything when email is off", async () => {
      mail.enabled = false;
      await service.register({ name: 'Ada', email: 'ada@example.com', password: 'secret123' });
      await new Promise(setImmediate);
      expect(mail.send).not.toHaveBeenCalled();
      expect(service.emailVerificationRequired).toBe(false);
      await expect(service.requestPasswordReset('ada@example.com')).rejects.toBeInstanceOf(
        NotImplementedException,
      );
    });

    it('resends the verification email only while the address is unconfirmed', async () => {
      users.findByIdWithSecrets.mockResolvedValue(makeUser() as never);
      await service.resendVerification('64b000000000000000000001');
      expect(mail.send).toHaveBeenCalledTimes(1);

      users.findByIdWithSecrets.mockResolvedValue(makeUser({ emailVerified: true }) as never);
      await service.resendVerification('64b000000000000000000001');
      users.findByIdWithSecrets.mockResolvedValue(makeUser({ googleId: 'g' }) as never);
      await service.resendVerification('64b000000000000000000001');
      expect(mail.send).toHaveBeenCalledTimes(1);
    });

    it('emails a reset link only to existing accounts, without saying which', async () => {
      await expect(service.requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
      expect(mail.send).not.toHaveBeenCalled();

      users.findByEmail.mockResolvedValue(makeUser() as never);
      mail.send.mockRejectedValueOnce(new Error('provider down'));
      await expect(service.requestPasswordReset('ada@example.com')).resolves.toBeUndefined();
      await service.requestPasswordReset('ada@example.com');
      expect(mail.send).toHaveBeenCalledTimes(2);
      expect((mail.send.mock.calls[1][0] as Mail).text).toContain('/reset-password?token=');
    });

    it('sets a new password from a valid reset link', async () => {
      users.findByEmail.mockResolvedValue(makeUser() as never);
      await service.requestPasswordReset('ada@example.com');
      const token = lastLinkToken();

      expect(await service.isPasswordResetTokenValid(token)).toBe(true);
      expect(await service.isPasswordResetTokenValid('nope')).toBe(false);
      expect(await service.resetPassword('nope', 'newpass123')).toBeNull();
      expect(await service.resetPassword(token, 'newpass123')).toBe('ada@example.com');

      const [id, tokenHash, passwordHash] = (users.resetPassword as jest.Mock).mock.calls[0] as [
        string,
        string,
        string,
      ];
      expect(id).toBe('64b000000000000000000001');
      expect(tokenHash).toBe(sha256(token));
      expect(await bcrypt.compare('newpass123', passwordHash)).toBe(true);
    });
  });
});
