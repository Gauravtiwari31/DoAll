import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import {
  GetTokenOptions,
  LoginTicket,
  OAuth2Client,
  TokenPayload,
  VerifyIdTokenOptions,
} from 'google-auth-library';
import { Connection, Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { CONTACT_EMAIL } from '../src/legal/legal.constants';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;

interface GoogleClaims {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  aud?: string;
  nonce?: string;
}

/**
 * Stands in for an ID token from Google: an unsigned JWT that the stubbed
 * OAuth2Client below accepts when it was "issued" to this app's client ID.
 */
const googleToken = (claims: GoogleClaims) => {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = {
    iss: 'https://accounts.google.com',
    aud: GOOGLE_CLIENT_ID,
    iat: 0,
    exp: 0,
    email_verified: true,
    ...claims,
  };
  return `${part({ alg: 'RS256', typ: 'JWT' })}.${part(payload)}.c2lnbmF0dXJl`;
};

describe('DoAll API (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;

  const HOUR = 60 * 60 * 1000;
  const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

  const titles = (body: unknown) => (body as { title: string }[]).map((t) => t.title);

  const register = (email: string, password = 'secret123', name = 'Test User') =>
    request(http).post('/api/auth/register').send({ name, email, password });

  /** One-time codes "issued" by the stubbed Google, mapped to their ID tokens. */
  const googleCodes = new Map<string, string>();
  /** redirect_uri of every code exchange, to compare with the authorization request. */
  const exchangedRedirects: string[] = [];

  beforeAll(async () => {
    // The real GoogleIdentityService runs; only its calls out to Google are stubbed.
    const verifyIdToken = ({ idToken, audience }: VerifyIdTokenOptions) => {
      const json = Buffer.from(idToken.split('.')[1], 'base64url').toString();
      const payload = JSON.parse(json) as TokenPayload;
      return payload.aud === audience
        ? Promise.resolve(new LoginTicket('envelope', payload))
        : Promise.reject(new Error('Wrong recipient, payload audience != requiredAudience'));
    };
    const getToken = ({ code, redirect_uri }: GetTokenOptions) => {
      exchangedRedirects.push(redirect_uri as string);
      const idToken = googleCodes.get(code);
      googleCodes.delete(code); // codes work once
      return idToken
        ? Promise.resolve({ tokens: { id_token: idToken }, res: null })
        : Promise.reject(new Error('invalid_grant'));
    };
    // Both methods also have a callback form; these stubs implement the promise form.
    (
      jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as unknown as jest.SpyInstance<
        Promise<LoginTicket>,
        [VerifyIdTokenOptions]
      >
    ).mockImplementation(verifyIdToken);
    (
      jest.spyOn(OAuth2Client.prototype, 'getToken') as unknown as jest.SpyInstance<
        ReturnType<typeof getToken>,
        [GetTokenOptions]
      >
    ).mockImplementation(getToken);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = app.getHttpServer();
    await app.get<Connection>(getConnectionToken()).dropDatabase();
  });

  afterAll(async () => {
    await app.get<Connection>(getConnectionToken()).dropDatabase();
    await app.close();
    jest.restoreAllMocks();
  });

  describe('auth', () => {
    it('registers, normalising the email and hiding secrets', async () => {
      const res = await register('  Ada@Example.com ').expect(201);
      expect(res.body.user).toEqual({
        id: expect.any(String),
        name: 'Test User',
        email: 'ada@example.com',
        signInMethods: ['password'],
        emailVerified: false,
        createdAt: expect.any(String),
      });
      expect(res.body.tokens).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 900,
      });
    });

    it('rejects duplicate emails with 409', async () => {
      const res = await register('ada@example.com').expect(409);
      expect(res.body.message).toMatch(/already exists/);
    });

    it('validates registration input', async () => {
      const res = await request(http)
        .post('/api/auth/register')
        .send({ name: 'A', email: 'not-an-email', password: 'short' })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'Name must be between 2 and 50 characters',
          'Please enter a valid email address',
          'Password must be at least 8 characters',
        ]),
      );
    });

    it('logs in with correct credentials only', async () => {
      await request(http)
        .post('/api/auth/login')
        .send({ email: 'ada@example.com', password: 'wrong-pass1' })
        .expect(401);
      const res = await request(http)
        .post('/api/auth/login')
        .send({ email: 'ADA@example.com', password: 'secret123' })
        .expect(200);
      expect(res.body.user.email).toBe('ada@example.com');
    });

    it('protects routes and returns the current user', async () => {
      await request(http).get('/api/auth/me').expect(401);
      await request(http).get('/api/auth/me').set('Authorization', 'Bearer garbage').expect(401);

      const { body } = await request(http)
        .post('/api/auth/login')
        .send({ email: 'ada@example.com', password: 'secret123' });
      const me = await request(http)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.tokens.accessToken}`)
        .expect(200);
      expect(me.body.email).toBe('ada@example.com');
    });

    it('rotates refresh tokens, detects reuse and supports logout', async () => {
      const { body: login } = await request(http)
        .post('/api/auth/login')
        .send({ email: 'ada@example.com', password: 'secret123' });

      const { body: refreshed } = await request(http)
        .post('/api/auth/refresh')
        .send({ refreshToken: login.tokens.refreshToken })
        .expect(200);
      expect(refreshed.tokens.refreshToken).not.toBe(login.tokens.refreshToken);

      // Replaying the rotated token revokes every session...
      await request(http)
        .post('/api/auth/refresh')
        .send({ refreshToken: login.tokens.refreshToken })
        .expect(401);
      // ...including the one that was just issued.
      await request(http)
        .post('/api/auth/refresh')
        .send({ refreshToken: refreshed.tokens.refreshToken })
        .expect(401);

      // Logout invalidates the session it belongs to.
      const { body: again } = await request(http)
        .post('/api/auth/login')
        .send({ email: 'ada@example.com', password: 'secret123' });
      await request(http)
        .post('/api/auth/logout')
        .send({ refreshToken: again.tokens.refreshToken })
        .expect(204);
      await request(http)
        .post('/api/auth/refresh')
        .send({ refreshToken: again.tokens.refreshToken })
        .expect(401);
    });
  });

  describe('tasks', () => {
    let token: string;
    let otherToken: string;
    const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

    beforeAll(async () => {
      token = (await register('tasks@example.com')).body.tokens.accessToken;
      otherToken = (await register('intruder@example.com')).body.tokens.accessToken;
    });

    it('requires authentication', async () => {
      await request(http).get('/api/tasks').expect(401);
    });

    it('creates a task with defaults and normalised tags', async () => {
      const res = await request(http)
        .post('/api/tasks')
        .set(auth())
        .send({ title: '  Write report  ', tags: ['#Work', 'work', ' Q3 '] })
        .expect(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          title: 'Write report',
          description: '',
          priority: 'medium',
          category: 'personal',
          tags: ['work', 'q3'],
          completed: false,
          deadline: null,
        }),
      );
    });

    it('validates task input', async () => {
      await request(http).post('/api/tasks').set(auth()).send({ title: '' }).expect(400);
      await request(http)
        .post('/api/tasks')
        .set(auth())
        .send({ title: 'x', priority: 'extreme' })
        .expect(400);
      await request(http)
        .post('/api/tasks')
        .set(auth())
        .send({ title: 'x', owner: '64b000000000000000000001' })
        .expect(400);
      const res = await request(http)
        .post('/api/tasks')
        .set(auth())
        .send({ title: 'x', scheduledAt: inHours(5), deadline: inHours(1) })
        .expect(400);
      expect(res.body.message).toMatch(/Deadline cannot be earlier/);
    });

    it('lists, filters, searches and smart-sorts', async () => {
      const create = (body: object) =>
        request(http).post('/api/tasks').set(auth()).send(body).expect(201);
      await create({
        title: 'Overdue invoice',
        priority: 'low',
        scheduledAt: inHours(-48),
        deadline: inHours(-2),
        category: 'work',
      });
      await create({
        title: 'Gym session',
        priority: 'high',
        scheduledAt: inHours(24 * 5),
        category: 'health',
      });
      await create({ title: 'Buy milk', description: 'and eggs', category: 'shopping' });

      const smart = await request(http).get('/api/tasks?sort=smart').set(auth()).expect(200);
      expect(smart.body).toHaveLength(4);
      expect(smart.body[0].title).toBe('Overdue invoice');

      const overdue = await request(http).get('/api/tasks?status=overdue').set(auth());
      expect(titles(overdue.body)).toEqual(['Overdue invoice']);

      const search = await request(http).get('/api/tasks?search=EGGS').set(auth());
      expect(titles(search.body)).toEqual(['Buy milk']);

      const health = await request(http).get('/api/tasks?category=health').set(auth());
      expect(health.body).toHaveLength(1);

      const tagged = await request(http).get('/api/tasks?tag=%23Q3').set(auth());
      expect(titles(tagged.body)).toEqual(['Write report']);

      await request(http).get('/api/tasks?sort=random').set(auth()).expect(400);
    });

    it('updates, completes, and deletes a task', async () => {
      const { body: task } = await request(http)
        .post('/api/tasks')
        .set(auth())
        .send({ title: 'Temp', deadline: inHours(3) })
        .expect(201);

      const updated = await request(http)
        .patch(`/api/tasks/${task.id}`)
        .set(auth())
        .send({ title: 'Renamed', priority: 'high', deadline: null })
        .expect(200);
      expect(updated.body).toEqual(
        expect.objectContaining({ title: 'Renamed', priority: 'high', deadline: null }),
      );

      const done = await request(http)
        .patch(`/api/tasks/${task.id}/status`)
        .set(auth())
        .send({ completed: true })
        .expect(200);
      expect(done.body.completed).toBe(true);
      expect(done.body.completedAt).toEqual(expect.any(String));

      const undone = await request(http)
        .patch(`/api/tasks/${task.id}/status`)
        .set(auth())
        .send({ completed: false })
        .expect(200);
      expect(undone.body.completedAt).toBeNull();

      await request(http).delete(`/api/tasks/${task.id}`).set(auth()).expect(204);
      await request(http).get(`/api/tasks/${task.id}`).set(auth()).expect(404);
      await request(http).get('/api/tasks/not-an-id').set(auth()).expect(400);
    });

    it("never exposes another user's tasks", async () => {
      const { body: list } = await request(http).get('/api/tasks').set(auth());
      const id = list[0].id as string;

      expect((await request(http).get('/api/tasks').set(auth(otherToken))).body).toEqual([]);
      await request(http).get(`/api/tasks/${id}`).set(auth(otherToken)).expect(404);
      await request(http)
        .patch(`/api/tasks/${id}`)
        .set(auth(otherToken))
        .send({ title: 'hacked' })
        .expect(404);
      await request(http).delete(`/api/tasks/${id}`).set(auth(otherToken)).expect(404);
    });

    it('reports stats and clears completed tasks', async () => {
      const { body: list } = await request(http).get('/api/tasks').set(auth());
      await request(http)
        .patch(`/api/tasks/${list[0].id}/status`)
        .set(auth())
        .send({ completed: true });

      const stats = await request(http).get('/api/tasks/stats?tzOffset=-330').set(auth());
      expect(stats.body).toEqual(
        expect.objectContaining({ total: 4, completed: 1, active: 3, completedToday: 1 }),
      );

      const cleared = await request(http).delete('/api/tasks/completed').set(auth()).expect(200);
      expect(cleared.body).toEqual({ deleted: 1 });
    });
  });

  /** Tasks still stored for a user id, read straight from the database. */
  const storedTaskCount = (userId: string) =>
    app
      .get<Connection>(getConnectionToken())
      .collection('tasks')
      .countDocuments({ owner: new Types.ObjectId(userId) });

  describe('account deletion (API)', () => {
    it('needs the password, then removes the user, their tasks and sessions', async () => {
      const { body: leaver } = await register('leaver@example.com').expect(201);
      const { body: bystander } = await register('bystander@example.com').expect(201);
      const auth = { Authorization: `Bearer ${leaver.tokens.accessToken}` };
      for (const t of [leaver, bystander]) {
        await request(http)
          .post('/api/tasks')
          .set({ Authorization: `Bearer ${t.tokens.accessToken}` })
          .send({ title: 'Keep me?' })
          .expect(201);
      }

      await request(http).delete('/api/auth/me').send({ password: 'secret123' }).expect(401);
      await request(http).delete('/api/auth/me').set(auth).send({}).expect(400);
      // 403, so the app doesn't mistake a typo for an expired session.
      const wrong = await request(http)
        .delete('/api/auth/me')
        .set(auth)
        .send({ password: 'wrong-pass1' })
        .expect(403);
      expect(wrong.body.message).toBe('Incorrect password');
      expect(await storedTaskCount(leaver.user.id as string)).toBe(1);

      await request(http)
        .delete('/api/auth/me')
        .set(auth)
        .send({ password: 'secret123' })
        .expect(204);

      expect(await storedTaskCount(leaver.user.id as string)).toBe(0);
      expect(await storedTaskCount(bystander.user.id as string)).toBe(1);
      // The access token is still unexpired, but the account is gone: nothing
      // can be read or stored with it any more.
      await request(http).get('/api/auth/me').set(auth).expect(401);
      await request(http).get('/api/tasks').set(auth).expect(401);
      await request(http).post('/api/tasks').set(auth).send({ title: 'Ghost' }).expect(401);
      expect(await storedTaskCount(leaver.user.id as string)).toBe(0);
      await request(http)
        .post('/api/auth/login')
        .send({ email: 'leaver@example.com', password: 'secret123' })
        .expect(401);
      await request(http)
        .post('/api/auth/refresh')
        .send({ refreshToken: leaver.tokens.refreshToken })
        .expect(401);
    });
  });

  describe('public pages', () => {
    const postForm = (fields: Record<string, string>) =>
      request(http).post('/account/delete').type('form').send(fields);

    it('serves the privacy policy as HTML outside /api', async () => {
      const res = await request(http).get('/privacy').expect(200);
      expect(res.headers['content-type']).toMatch(/^text\/html/);
      expect(res.text).toContain('privacy policy');
      expect(res.text).toContain(CONTACT_EMAIL);

      await request(http).get('/api/privacy').expect(404);
      await request(http).get('/api/health').expect(200);
    });

    it('serves the account deletion form', async () => {
      const res = await request(http).get('/account/delete').expect(200);
      expect(res.headers['content-type']).toMatch(/^text\/html/);
      expect(res.text).toContain('<form method="post" action="/account/delete">');
      expect(res.text).toContain('Profile → Delete account');
    });

    it('answers form mistakes with HTML, never JSON, and escapes what was typed', async () => {
      const unconfirmed = await postForm({
        email: '"><script>alert(1)</script>',
        password: 'x',
      }).expect(400);
      expect(unconfirmed.headers['content-type']).toMatch(/^text\/html/);
      expect(unconfirmed.text).toContain('Please enter a valid email address');
      expect(unconfirmed.text).toContain('Please tick the box');
      expect(unconfirmed.text).not.toContain('<script>alert(1)</script>');

      const wrong = await postForm({
        email: 'nobody@example.com',
        password: 'wrong-pass1',
        confirm: 'yes',
      }).expect(401);
      expect(wrong.headers['content-type']).toMatch(/^text\/html/);
      expect(wrong.text).toContain('Incorrect email or password');
    });

    it('deletes the account and its tasks from the web', async () => {
      const { body: user } = await register('web-leaver@example.com').expect(201);
      await request(http)
        .post('/api/tasks')
        .set({ Authorization: `Bearer ${user.tokens.accessToken}` })
        .send({ title: 'Last task' })
        .expect(201);

      const res = await postForm({
        email: ' Web-Leaver@Example.com ',
        password: 'secret123',
        confirm: 'yes',
      }).expect(200);
      expect(res.headers['content-type']).toMatch(/^text\/html/);
      expect(res.text).toContain('has been permanently deleted');

      expect(await storedTaskCount(user.user.id as string)).toBe(0);
      await request(http)
        .post('/api/auth/login')
        .send({ email: 'web-leaver@example.com', password: 'secret123' })
        .expect(401);
    });
  });

  describe('Google sign-in (API)', () => {
    const google = (body: object) => request(http).post('/api/auth/google').send(body);
    const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

    it('creates the account the first time, then signs in to it', async () => {
      const token = googleToken({ sub: 'g-gina', email: 'Gina@Example.com', name: 'Gina Google' });

      const first = await google({ idToken: token }).expect(200);
      expect(first.body.user).toEqual({
        id: expect.any(String),
        name: 'Gina Google',
        email: 'gina@example.com',
        signInMethods: ['google'],
        emailVerified: true,
        createdAt: expect.any(String),
      });
      const me = await request(http)
        .get('/api/auth/me')
        .set(bearer(first.body.tokens.accessToken as string))
        .expect(200);
      expect(me.body.signInMethods).toEqual(['google']);

      const again = await google({ idToken: token }).expect(200);
      expect(again.body.user.id).toBe(first.body.user.id);
    });

    it('refuses tokens issued to another app, and unverified addresses', async () => {
      const other = await google({
        idToken: googleToken({ sub: 'g-x', email: 'x@example.com', aud: 'another-app' }),
      }).expect(401);
      expect(other.body.message).toMatch(/Google couldn't confirm your account/);

      await google({
        idToken: googleToken({ sub: 'g-y', email: 'y@example.com', email_verified: false }),
      }).expect(401);
    });

    it('has no password to log in with', async () => {
      const login = await request(http)
        .post('/api/auth/login')
        .send({ email: 'gina@example.com', password: 'secret123' })
        .expect(401);
      expect(login.body.message).toMatch(/signs in with Google/);
    });

    it("connects Google to a password account only with that account's password", async () => {
      await register('link@example.com').expect(201);
      const token = googleToken({ sub: 'g-link', email: 'link@example.com' });

      const ask = await google({ idToken: token }).expect(409);
      expect(ask.body).toEqual(
        expect.objectContaining({
          code: 'GOOGLE_LINK_PASSWORD_REQUIRED',
          email: 'link@example.com',
        }),
      );
      await google({ idToken: token, password: 'wrong-pass1' }).expect(403);

      const linked = await google({ idToken: token, password: 'secret123' }).expect(200);
      expect(linked.body.user.signInMethods).toEqual(['password', 'google']);

      // From now on both ways work.
      const viaGoogle = await google({ idToken: token }).expect(200);
      expect(viaGoogle.body.user.id).toBe(linked.body.user.id);
      await request(http)
        .post('/api/auth/login')
        .send({ email: 'link@example.com', password: 'secret123' })
        .expect(200);
    });

    it('deletes a Google account after choosing the same Google account again', async () => {
      const own = googleToken({ sub: 'g-gone', email: 'gone@example.com' });
      const { body } = await google({ idToken: own }).expect(200);
      const auth = bearer(body.tokens.accessToken as string);

      const noPassword = await request(http)
        .delete('/api/auth/me')
        .set(auth)
        .send({ password: 'secret123' })
        .expect(403);
      expect(noPassword.body.message).toMatch(/Confirm with Google/);
      await request(http)
        .delete('/api/auth/me')
        .set(auth)
        .send({ googleIdToken: googleToken({ sub: 'g-gina', email: 'gina@example.com' }) })
        .expect(403);

      await request(http).delete('/api/auth/me').set(auth).send({ googleIdToken: own }).expect(204);
      await request(http).get('/api/auth/me').set(auth).expect(401);
    });
  });

  describe('Google deletion (web)', () => {
    const users = () => app.get<Connection>(getConnectionToken()).collection('users');

    /** An account straight in the database, with one task. */
    const seedAccount = async (fields: { email: string; googleId?: string }) => {
      const now = new Date();
      const { insertedId } = await users().insertOne({
        name: 'Seeded',
        sessions: [],
        createdAt: now,
        updatedAt: now,
        ...fields,
      });
      await app
        .get<Connection>(getConnectionToken())
        .collection('tasks')
        .insertOne({ owner: insertedId, title: 'Seeded task', scheduledAt: now });
      return insertedId.toHexString();
    };

    const startDeletion = async () => {
      const res = await request(http)
        .post('/account/delete/google')
        .set('Sec-Fetch-Site', 'same-origin')
        .type('form')
        .send({ confirm: 'yes' })
        .expect(303);
      const location = new URL(res.headers.location);
      const setCookie = res.headers['set-cookie'] as unknown as string[];
      return {
        location,
        setCookie: setCookie[0],
        cookie: setCookie[0].split(';')[0],
        state: location.searchParams.get('state') as string,
        nonce: location.searchParams.get('nonce') as string,
      };
    };
    type Flow = Awaited<ReturnType<typeof startDeletion>>;

    let codeCount = 0;
    /** Google "issuing" a one-time code once the person chose the account in `claims`. */
    const issueCode = (flow: Flow, claims: GoogleClaims) => {
      const code = `code-${++codeCount}`;
      googleCodes.set(code, googleToken({ ...claims, nonce: flow.nonce }));
      return code;
    };
    /** Google sending the browser back with a code. */
    const callback = (flow: Flow, code: string, state = flow.state) =>
      request(http)
        .get('/account/delete/google/callback')
        .query({ state, code })
        .set('Cookie', flow.cookie);
    const returnFromGoogle = (flow: Flow, claims: GoogleClaims, state?: string) =>
      callback(flow, issueCode(flow, claims), state);

    it('offers Google on the deletion page, with a CSP that allows the redirect', async () => {
      const res = await request(http).get('/account/delete').expect(200);
      expect(res.text).toContain('<form method="post" action="/account/delete/google">');
      expect(res.text).toContain('Continue with Google');
      expect(res.headers['content-security-policy']).toContain(
        "form-action 'self' https://accounts.google.com",
      );
      expect(res.headers['referrer-policy']).toBe('same-origin');
    });

    it('only starts from its own page, with the box ticked', async () => {
      const start = () => request(http).post('/account/delete/google').type('form');
      const foreign = await start().send({ confirm: 'yes' }).expect(403);
      expect(foreign.headers['content-type']).toMatch(/^text\/html/);
      await start().set('Sec-Fetch-Site', 'cross-site').send({ confirm: 'yes' }).expect(403);

      const unticked = await start().set('Sec-Fetch-Site', 'same-origin').send({}).expect(400);
      expect(unticked.text).toContain('Please tick the box');
    });

    it("sends the browser to Google's account chooser with a state and nonce", async () => {
      const flow = await startDeletion();
      expect(flow.location.origin + flow.location.pathname).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      expect(flow.location.searchParams.get('client_id')).toBe(GOOGLE_CLIENT_ID);
      expect(flow.location.searchParams.get('redirect_uri')).toMatch(
        /^http:\/\/127\.0\.0\.1:\d+\/account\/delete\/google\/callback$/,
      );
      expect(flow.location.searchParams.get('prompt')).toBe('select_account');
      expect(flow.state).toMatch(/^[\w-]{43}$/);
      expect(flow.nonce).toMatch(/^[\w-]{43}$/);
      expect(flow.setCookie).toMatch(/^doall_google_delete=[\w-]+\.[\w-]+;/);
      for (const attribute of [
        'Max-Age=600',
        'Path=/account/delete/google/callback',
        'HttpOnly',
        'SameSite=Lax',
      ]) {
        expect(flow.setCookie).toContain(attribute);
      }
      // Plain HTTP here; behind HTTPS (req.secure) the cookie is Secure too.
      expect(flow.setCookie).not.toContain('Secure');
    });

    it('deletes the account connected to the chosen Google account', async () => {
      const id = await seedAccount({ email: 'web-google@example.com', googleId: 'g-web' });
      const flow = await startDeletion();
      const code = issueCode(flow, { sub: 'g-web', email: 'web-google@example.com' });

      const res = await callback(flow, code);

      expect(res.status).toBe(200);
      expect(res.text).toContain('has been permanently deleted');
      expect(res.headers['set-cookie']?.[0]).toMatch(/^doall_google_delete=;/);
      expect(await storedTaskCount(id)).toBe(0);
      expect(await users().countDocuments({ googleId: 'g-web' })).toBe(0);
      // The code is redeemed for the same redirect_uri it was requested with.
      // (supertest serves each request on a new port, so the port is left out.)
      const withoutPort = (url: string | null | undefined) =>
        url?.replace(/:\d+\//, '/') ?? 'missing';
      expect(withoutPort(exchangedRedirects.at(-1))).toBe(
        withoutPort(flow.location.searchParams.get('redirect_uri')),
      );

      // Google's codes only work once.
      const replay = await callback(flow, code);
      expect(replay.status).toBe(401);
      expect(replay.text).toContain("Google couldn't confirm your account");
    });

    it('also deletes a password account registered with the verified address', async () => {
      const id = await seedAccount({ email: 'web-password@example.com' });
      const flow = await startDeletion();
      const res = await returnFromGoogle(flow, { sub: 'g-new', email: 'web-password@example.com' });
      expect(res.status).toBe(200);
      expect(await storedTaskCount(id)).toBe(0);
    });

    it('deletes nothing without a matching sign-in or account', async () => {
      const id = await seedAccount({ email: 'stays@example.com', googleId: 'g-stays' });
      const flow = await startDeletion();

      const forged = await returnFromGoogle(
        flow,
        { sub: 'g-stays', email: 'stays@example.com' },
        'x',
      );
      expect(forged.status).toBe(400);
      expect(forged.text).toContain('Please start again');

      const noCookie = await request(http)
        .get('/account/delete/google/callback')
        .query({ state: flow.state, code: 'code-x' })
        .expect(400);
      expect(noCookie.headers['content-type']).toMatch(/^text\/html/);

      const cancelled = await request(http)
        .get('/account/delete/google/callback')
        .query({ error: 'access_denied', state: flow.state })
        .set('Cookie', flow.cookie)
        .expect(200);
      expect(cancelled.text).toContain('Nothing was deleted');

      const stranger = await startDeletion();
      const unknown = await returnFromGoogle(stranger, { sub: 'g-who', email: 'who@example.com' });
      expect(unknown.status).toBe(404);
      expect(unknown.text).toContain('who@example.com');

      expect(await storedTaskCount(id)).toBe(1);
    });

    it('tells Google accounts on the password form to use Google', async () => {
      const res = await request(http)
        .post('/account/delete')
        .type('form')
        .send({ email: 'stays@example.com', password: 'secret123', confirm: 'yes' })
        .expect(401);
      expect(res.text).toContain('This account signs in with Google');
    });
  });
});
