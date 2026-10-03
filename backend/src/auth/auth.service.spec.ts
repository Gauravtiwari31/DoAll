import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { sha256 } from '../common/utils/hash';
import { RefreshSession } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

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

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersService>;
  let savedSessions: RefreshSession[];

  beforeEach(async () => {
    savedSessions = [];
    users = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailWithSecrets: jest.fn(),
      findByIdWithSessions: jest.fn(),
      replaceSessions: jest.fn((_id: string, sessions: RefreshSession[]) => {
        savedSessions = sessions;
        return Promise.resolve();
      }),
    } as unknown as jest.Mocked<UsersService>;

    const config = {
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
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('registers a user with a hashed password and returns tokens', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockImplementation((data) => Promise.resolve(makeUser(data) as never));

    const result = await service.register({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'secret123',
    });

    const created = users.create.mock.calls[0][0];
    expect(created.passwordHash).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', created.passwordHash)).toBe(true);
    expect(result.user).toEqual(expect.objectContaining({ email: 'ada@example.com' }));
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

  it('rotates refresh tokens and revokes everything on reuse', async () => {
    users.findByEmailWithSecrets.mockResolvedValue(makeUser() as never);
    const { tokens } = await service.login({ email: 'ada@example.com', password: 'secret123' });

    // First use: valid, rotated.
    users.findByIdWithSessions.mockResolvedValue(makeUser({ sessions: savedSessions }) as never);
    const rotated = await service.refresh(tokens.refreshToken);
    expect(rotated.tokens.refreshToken).not.toBe(tokens.refreshToken);
    expect(savedSessions.map((s) => s.tokenHash)).toEqual([sha256(rotated.tokens.refreshToken)]);

    // Second use of the old token: treated as theft.
    users.findByIdWithSessions.mockResolvedValue(makeUser({ sessions: savedSessions }) as never);
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
});
