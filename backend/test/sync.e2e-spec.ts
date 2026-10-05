import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Connection } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { SETTLE_MS, SYNC_PAGE_SIZE } from '../src/sync/sync.service';

/**
 * Sync, email verification and password reset, with email switched on. The
 * email provider is stubbed: every message "sent" lands in `outbox`.
 */
describe('Sync and email links (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  const outbox: { to: string; text: string }[] = [];
  const realNow = Date.now.bind(Date);

  /** Lets the server's sync see changes that are still settling (see SETTLE_MS). */
  const settle = () => {
    const offset = SETTLE_MS + 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
  };

  beforeAll(async () => {
    process.env.MAIL_PROVIDER = 'resend';
    process.env.MAIL_API_KEY = 'e2e-key';
    process.env.MAIL_FROM = 'DoAll <no-reply@example.com>';
    process.env.PUBLIC_URL = 'https://doall.example.com';
    const realFetch = global.fetch;
    jest.spyOn(global, 'fetch').mockImplementation((url, init) => {
      const target = url instanceof Request ? url.url : url.toString();
      if (target !== 'https://api.resend.com/emails') return realFetch(url, init);
      const body = JSON.parse(init?.body as string) as { to: string[]; text: string };
      outbox.push({ to: body.to[0], text: body.text });
      return Promise.resolve(new Response('{"id":"x"}', { status: 200 }));
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = app.getHttpServer();
    await app.get<Connection>(getConnectionToken()).dropDatabase();
    // Indexes are built in the background; the unique one matters here.
    await app.get<Connection>(getConnectionToken()).syncIndexes();
  });

  afterEach(() => {
    (Date.now as jest.Mock).mockRestore?.();
  });

  afterAll(async () => {
    await app.get<Connection>(getConnectionToken()).dropDatabase();
    await app.close();
    jest.restoreAllMocks();
    delete process.env.MAIL_PROVIDER;
  });

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Token in the link of the last email sent to `to`. */
  const linkToken = (to: string, path: string) => {
    const mail = outbox.filter((m) => m.to === to).at(-1);
    const match = new RegExp(`https://doall\\.example\\.com/${path}\\?token=([\\w-]+)`).exec(
      mail?.text ?? '',
    );
    if (!match) throw new Error(`No ${path} link was emailed to ${to}`);
    return match[1];
  };

  /** Signs up and confirms the address, like a user who clicked the link. */
  const verifiedUser = async (email: string) => {
    const res = await request(http)
      .post('/api/auth/register')
      .send({ name: 'Sync User', email, password: 'secret123' })
      .expect(201);
    await new Promise((resolve) => setTimeout(resolve, 50)); // the email goes out after the answer
    await request(http)
      .get(`/verify-email?token=${linkToken(email, 'verify-email')}`)
      .expect(200);
    return res.body.tokens.accessToken as string;
  };

  const task = (overrides: Record<string, unknown> = {}) => ({
    id: randomUUID(),
    title: 'Water the plants',
    description: '',
    scheduledAt: '2026-10-06T03:30:00.000Z',
    deadline: null,
    priority: 'medium',
    category: 'personal',
    tags: [],
    completed: false,
    completedAt: null,
    reminderOffset: 10,
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3], byMonthDay: null },
    timeZone: 'Asia/Kolkata',
    createdAt: '2026-10-05T10:00:00.000Z',
    updatedAt: '2026-10-05T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  });

  type SyncBody = {
    changes: { id: string; title: string; updatedAt: string; deletedAt: string | null }[];
    cursor: string;
    hasMore: boolean;
    reset: boolean;
  };

  const sync = async (token: string, body: object, status = 200) =>
    (await request(http).post('/api/sync').set(bearer(token)).send(body).expect(status))
      .body as SyncBody;

  describe('email verification', () => {
    it('emails a link on sign-up; sync waits until it is opened', async () => {
      const email = 'verify@example.com';
      const res = await request(http)
        .post('/api/auth/register')
        .send({ name: 'Vera', email, password: 'secret123' })
        .expect(201);
      expect(res.body.user.emailVerified).toBe(false);
      const token = res.body.tokens.accessToken as string;

      const refused = await request(http)
        .post('/api/sync')
        .set(bearer(token))
        .send({ changes: [task()] })
        .expect(403);
      expect(refused.body.code).toBe('EMAIL_NOT_VERIFIED');
      // Downloading works meanwhile.
      await sync(token, { changes: [] });

      await request(http).post('/api/auth/verify-email/resend').set(bearer(token)).expect(204);
      const page = await request(http)
        .get(`/verify-email?token=${linkToken(email, 'verify-email')}`)
        .expect(200);
      expect(page.text).toContain('Your email is confirmed');

      // A link works once.
      await request(http)
        .get(`/verify-email?token=${linkToken(email, 'verify-email')}`)
        .expect(404);
      const me = await request(http).get('/api/auth/me').set(bearer(token)).expect(200);
      expect(me.body.emailVerified).toBe(true);
      await sync(token, { changes: [] });
    });
  });

  describe('password reset', () => {
    const email = 'forgetful@example.com';

    it("doesn't reveal whether an address has an account", async () => {
      await request(http)
        .post('/api/auth/password/forgot')
        .send({ email: 'nobody@example.com' })
        .expect(204);
      expect(outbox.some((m) => m.to === 'nobody@example.com')).toBe(false);
    });

    it('sets a new password from the emailed link and signs every device out', async () => {
      const registered = await request(http)
        .post('/api/auth/register')
        .send({ name: 'Fred', email, password: 'secret123' })
        .expect(201);
      await request(http).post('/api/auth/password/forgot').send({ email }).expect(204);
      const token = linkToken(email, 'reset-password');

      const form = await request(http).get(`/reset-password?token=${token}`).expect(200);
      expect(form.text).toContain('Choose a new password');

      const mismatch = await request(http)
        .post('/reset-password')
        .type('form')
        .send({ token, password: 'newpass123', confirmPassword: 'newpass124' })
        .expect(400);
      expect(mismatch.text).toContain('match');
      const weak = await request(http)
        .post('/reset-password')
        .type('form')
        .send({ token, password: 'short', confirmPassword: 'short' })
        .expect(400);
      expect(weak.text).toContain('at least 8 characters');

      const done = await request(http)
        .post('/reset-password')
        .type('form')
        .send({ token, password: 'newpass123', confirmPassword: 'newpass123' })
        .expect(200);
      expect(done.text).toContain('Your password is changed');

      await request(http)
        .post('/api/auth/refresh')
        .send({ refreshToken: registered.body.tokens.refreshToken })
        .expect(401);
      await request(http)
        .post('/api/auth/login')
        .send({ email, password: 'secret123' })
        .expect(401);
      const login = await request(http)
        .post('/api/auth/login')
        .send({ email, password: 'newpass123' })
        .expect(200);
      // Using the link proved the address works.
      expect(login.body.user.emailVerified).toBe(true);

      // The link worked once.
      await request(http).get(`/reset-password?token=${token}`).expect(404);
    });
  });

  describe('sync', () => {
    let token: string;
    let otherToken: string;

    beforeAll(async () => {
      token = await verifiedUser('sync@example.com');
      otherToken = await verifiedUser('sync-other@example.com');
    });

    it('validates changes', async () => {
      await sync(token, { changes: [task({ title: '' })] }, 400);
      await sync(token, { changes: [task({ id: 'not an id!' })] }, 400);
      await sync(token, { changes: [task({ owner: 'someone' })] }, 400);
      await sync(
        token,
        { changes: [task({ recurrence: { freq: 'daily', interval: 0, byWeekday: [] } })] },
        400,
      );
    });

    it('keeps a task with an unknown time zone, without the zone', async () => {
      const userToken = await verifiedUser('zone@example.com');
      const odd = task({ timeZone: 'GMT+05:30' });
      await sync(userToken, { changes: [odd] });
      settle();
      const all = await sync(userToken, { changes: [] });
      expect(all.changes.find((t) => t.id === odd.id)).toEqual(
        expect.objectContaining({ timeZone: null }),
      );
    });

    it("pushes, then pulls everyone else's changes by the server's clock", async () => {
      const first = await sync(token, { changes: [] });
      expect(first.changes).toEqual([]);

      const plants = task();
      const pushed = await sync(token, { cursor: first.cursor, changes: [plants] });
      // Still settling: handed out on a later sync.
      expect(pushed.changes).toEqual([]);

      settle();
      // A second device starting from scratch gets the task, as sent.
      const second = await sync(token, { changes: [] });
      expect(second.changes).toEqual([
        expect.objectContaining({
          id: plants.id,
          title: 'Water the plants',
          reminderOffset: 10,
          recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3], byMonthDay: null },
          timeZone: 'Asia/Kolkata',
          createdAt: plants.createdAt,
          updatedAt: plants.updatedAt,
          deletedAt: null,
        }),
      ]);
      // ...and then nothing more.
      expect((await sync(token, { cursor: second.cursor, changes: [] })).changes).toEqual([]);

      // Other users never see it.
      expect((await sync(otherToken, { changes: [] })).changes).toEqual([]);
    });

    it('keeps the latest write and sends the winner back for refused changes', async () => {
      const original = task({ title: 'v1', updatedAt: '2026-10-05T10:00:00.000Z' });
      await sync(token, { changes: [original] });

      const newer = { ...original, title: 'v2', updatedAt: '2026-10-05T11:00:00.000Z' };
      await sync(token, { changes: [newer] });

      const stale = { ...original, title: 'stale', updatedAt: '2026-10-05T10:30:00.000Z' };
      const answer = await sync(token, { cursor: `${realNow() + 60_000}_`, changes: [stale] });
      expect(answer.changes).toEqual([expect.objectContaining({ id: original.id, title: 'v2' })]);

      // Replaying a request changes nothing.
      await sync(token, { changes: [newer] });
      settle();
      const all = await sync(token, { changes: [] });
      expect(all.changes.find((t) => t.id === original.id)?.title).toBe('v2');
    });

    it("doesn't let a device clock far in the future win forever", async () => {
      const id = randomUUID();
      await sync(token, {
        changes: [task({ id, title: 'future', updatedAt: '2099-01-01T00:00:00.000Z' })],
      });
      const now = new Date(realNow() + 60 * 60 * 1000).toISOString();
      await sync(token, { changes: [task({ id, title: 'fixed', updatedAt: now })] });
      settle();
      const all = await sync(token, { changes: [] });
      expect(all.changes.find((t) => t.id === id)?.title).toBe('fixed');
    });

    it('spreads deletions as tombstones, but not to devices starting from scratch', async () => {
      const doomed = task({ title: 'doomed' });
      await sync(token, { changes: [doomed] });
      settle();
      const before = await sync(token, { changes: [] });
      (Date.now as jest.Mock).mockRestore();

      const deletedAt = new Date(realNow()).toISOString();
      await sync(token, {
        changes: [{ ...doomed, deletedAt, updatedAt: deletedAt }],
      });
      settle();
      const after = await sync(token, { cursor: before.cursor, changes: [] });
      expect(after.changes).toEqual([
        expect.objectContaining({
          id: doomed.id,
          deletedAt,
          title: 'Deleted task',
          description: '',
        }),
      ]);
      const fresh = await sync(token, { changes: [] });
      expect(fresh.changes.map((t) => t.id)).not.toContain(doomed.id);
    });

    it('tells a device that was away too long to start over', async () => {
      const answer = await sync(token, { cursor: '1000_', changes: [] });
      expect(answer.reset).toBe(true);
      expect(answer.changes.every((t) => t.deletedAt === null)).toBe(true);
      expect((await sync(token, { changes: [] })).reset).toBe(false);
    });

    it('hands out large backlogs in pages', async () => {
      const userToken = await verifiedUser('many@example.com');
      const total = SYNC_PAGE_SIZE + 20;
      for (let i = 0; i < total; i += 200) {
        const changes = Array.from({ length: Math.min(200, total - i) }, (_, n) =>
          task({ title: `Task ${i + n}` }),
        );
        await sync(userToken, { changes });
      }
      settle();
      const page1 = await sync(userToken, { changes: [] });
      expect(page1.changes).toHaveLength(SYNC_PAGE_SIZE);
      expect(page1.hasMore).toBe(true);
      const page2 = await sync(userToken, { cursor: page1.cursor, changes: [] });
      expect(page2.changes).toHaveLength(20);
      expect(page2.hasMore).toBe(false);
      const ids = new Set([...page1.changes, ...page2.changes].map((t) => t.id));
      expect(ids.size).toBe(total);
    });

    it('sees tasks from the REST API that older app versions use, and the other way round', async () => {
      const userToken = await verifiedUser('mixed@example.com');
      const created = await request(http)
        .post('/api/tasks')
        .set(bearer(userToken))
        .send({ title: 'From an old app' })
        .expect(201);

      settle();
      const pulled = await sync(userToken, { changes: [] });
      expect(pulled.changes).toEqual([
        expect.objectContaining({ id: created.body.id, title: 'From an old app' }),
      ]);
      (Date.now as jest.Mock).mockRestore();

      // A new app edits it; the old app sees the edit.
      const edited = {
        ...task({ id: created.body.id as string, title: 'Edited in sync' }),
        updatedAt: new Date(realNow()).toISOString(),
      };
      await sync(userToken, { changes: [edited] });
      const list = await request(http).get('/api/tasks').set(bearer(userToken)).expect(200);
      expect((list.body as { title: string }[]).map((t) => t.title)).toEqual(['Edited in sync']);

      // The old app deletes it; the new app gets a tombstone.
      await request(http)
        .delete(`/api/tasks/${created.body.id}`)
        .set(bearer(userToken))
        .expect(204);
      await request(http).get(`/api/tasks/${created.body.id}`).set(bearer(userToken)).expect(404);
      settle();
      const after = await sync(userToken, { cursor: pulled.cursor, changes: [] });
      expect(after.changes).toEqual([
        expect.objectContaining({ id: created.body.id, deletedAt: expect.any(String) }),
      ]);
    });
  });
});
