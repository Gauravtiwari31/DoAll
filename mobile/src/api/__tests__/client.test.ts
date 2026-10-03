import axios, {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { session } from '../../services/session';
import { api, setSessionExpiredHandler } from '../client';

const ok = (
  config: InternalAxiosRequestConfig,
  data: unknown,
): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const unauthorized = (config: InternalAxiosRequestConfig) =>
  Promise.reject(
    new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
      ...ok(config, { message: 'Invalid or expired access token' }),
      status: 401,
    }),
  );

/**
 * Fake server: accepts only `Bearer fresh-access`, and hands out that token
 * from /auth/refresh. Records every call so tests can assert on them.
 */
function installServer({ refreshFails = false } = {}) {
  const calls: string[] = [];
  const adapter: AxiosAdapter = async config => {
    const auth = String(config.headers?.Authorization ?? '');
    calls.push(`${config.url} ${auth}`.trim());
    if (config.url?.endsWith('/auth/refresh')) {
      if (refreshFails) {
        return unauthorized(config);
      }
      return ok(config, {
        tokens: {
          accessToken: 'fresh-access',
          refreshToken: 'fresh-refresh',
          expiresIn: 900,
        },
      });
    }
    return auth === 'Bearer fresh-access'
      ? ok(config, { path: config.url })
      : unauthorized(config);
  };
  api.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  return calls;
}

describe('api client auth handling', () => {
  beforeEach(async () => {
    // A session whose access token the server no longer accepts.
    await session.save({
      accessToken: 'stale-access',
      refreshToken: 'old-refresh',
      expiresIn: 900,
    });
  });

  it('refreshes once for concurrent 401s and replays every request', async () => {
    const calls = installServer();

    const results = await Promise.all([
      api.get('/tasks'),
      api.get('/auth/me'),
      api.get('/tasks/1'),
    ]);

    expect(results.map(r => r.data.path)).toEqual([
      '/tasks',
      '/auth/me',
      '/tasks/1',
    ]);
    expect(calls.filter(c => c.includes('/auth/refresh'))).toHaveLength(1);
    expect(session.get()).toEqual(
      expect.objectContaining({
        accessToken: 'fresh-access',
        refreshToken: 'fresh-refresh',
      }),
    );
  });

  it('refreshes proactively when the access token is about to expire', async () => {
    const calls = installServer();
    await session.save({
      accessToken: 'stale-access',
      refreshToken: 'old-refresh',
      expiresIn: 5,
    });

    await api.get('/tasks');

    // Refresh happened before the request, so the request never saw a 401.
    expect(calls).toEqual([
      expect.stringContaining('/auth/refresh'),
      '/tasks Bearer fresh-access',
    ]);
  });

  it('clears the session and notifies the app when refresh is rejected', async () => {
    installServer({ refreshFails: true });
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);

    await expect(api.get('/tasks')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(session.get()).toBeNull();
  });
});
