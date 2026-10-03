import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('DoAll API (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;

  const HOUR = 60 * 60 * 1000;
  const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

  const titles = (body: unknown) => (body as { title: string }[]).map((t) => t.title);

  const register = (email: string, password = 'secret123', name = 'Test User') =>
    request(http).post('/api/auth/register').send({ name, email, password });

  beforeAll(async () => {
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
  });

  describe('auth', () => {
    it('registers, normalising the email and hiding secrets', async () => {
      const res = await register('  Ada@Example.com ').expect(201);
      expect(res.body.user).toEqual({
        id: expect.any(String),
        name: 'Test User',
        email: 'ada@example.com',
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
});
