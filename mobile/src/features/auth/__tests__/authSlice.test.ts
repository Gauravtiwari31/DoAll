import { configureStore } from '@reduxjs/toolkit';
import axios, {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { api } from '../../../api/client';
import NativeGoogleSignIn from '../../../native/NativeGoogleSignIn';
import { session } from '../../../services/session';
import { STORAGE_KEYS, storage } from '../../../services/storage';
import reducer, {
  deleteAccount,
  login,
  logout,
  register,
  restoreSession,
  sessionExpired,
  signInWithGoogle,
} from '../authSlice';

const user = {
  id: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('authSlice', () => {
  it('starts in the restoring state', () => {
    expect(reducer(undefined, { type: '@@init' }).status).toBe('restoring');
  });

  it('resolves the restore step either way', () => {
    const start = reducer(undefined, { type: '@@init' });
    expect(
      reducer(start, { type: restoreSession.fulfilled.type, payload: user })
        .status,
    ).toBe('signedIn');
    expect(
      reducer(start, { type: restoreSession.fulfilled.type, payload: null })
        .status,
    ).toBe('signedOut');
  });

  it.each([login, register])('%s tracks submitting and signs in', thunk => {
    const start = reducer(undefined, { type: '@@init' });
    const pending = reducer(start, { type: thunk.pending.type });
    expect(pending.submitting).toBe(true);

    const done = reducer(pending, {
      type: thunk.fulfilled.type,
      payload: user,
    });
    expect(done).toEqual(
      expect.objectContaining({ status: 'signedIn', submitting: false, user }),
    );

    const failed = reducer(pending, {
      type: thunk.rejected.type,
      payload: 'Incorrect email or password',
    });
    expect(failed.submitting).toBe(false);
    expect(failed.status).toBe('restoring');
  });

  it('signs out with a notice when the session expires', () => {
    const signedIn = reducer(undefined, {
      type: login.fulfilled.type,
      payload: user,
    });
    const expired = reducer(signedIn, sessionExpired());
    expect(expired.status).toBe('signedOut');
    expect(expired.user).toBeNull();
    expect(expired.notice).toMatch(/expired/);

    const loggedOut = reducer(signedIn, { type: logout.fulfilled.type });
    expect(loggedOut).toEqual(
      expect.objectContaining({
        status: 'signedOut',
        user: null,
        notice: null,
      }),
    );
  });

  it('signs out without a notice once the account is deleted', () => {
    const signedIn = reducer(undefined, {
      type: login.fulfilled.type,
      payload: user,
    });
    const failed = reducer(signedIn, {
      type: deleteAccount.rejected.type,
      payload: 'Incorrect password',
    });
    expect(failed).toEqual(signedIn);

    const deleted = reducer(signedIn, { type: deleteAccount.fulfilled.type });
    expect(deleted).toEqual(reducer(signedIn, { type: logout.fulfilled.type }));
  });
});

/**
 * Fake API for DELETE /auth/me: accepts only "right-password" (204) and
 * answers anything else with 403, like the server. Records every request.
 */
function installServer() {
  const requests: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async config => {
    requests.push(config);
    const response: AxiosResponse = {
      data: undefined,
      status: 204,
      statusText: 'No Content',
      headers: {},
      config,
    };
    if (JSON.parse(config.data).password === 'right-password') {
      return response;
    }
    throw new axios.AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, null, {
      ...response,
      status: 403,
      data: { message: 'Incorrect password', statusCode: 403 },
    });
  };
  api.defaults.adapter = adapter;
  return requests;
}

describe('deleteAccount', () => {
  const signedInStore = () => {
    const store = configureStore({ reducer: { auth: reducer } });
    store.dispatch({ type: login.fulfilled.type, payload: user });
    return store;
  };

  beforeEach(async () => {
    await session.save({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
    });
    await storage.set(STORAGE_KEYS.user, user);
  });

  it('deletes the account, then forgets the session like logout', async () => {
    const requests = installServer();
    const store = signedInStore();

    const signOutOfGoogle = jest.mocked(NativeGoogleSignIn!.signOut);
    signOutOfGoogle.mockClear();

    const result = await store.dispatch(
      deleteAccount({ password: 'right-password' }),
    );

    expect(result.type).toBe(deleteAccount.fulfilled.type);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: 'delete', url: '/auth/me' });
    expect(JSON.parse(requests[0].data)).toEqual({
      password: 'right-password',
    });
    expect(session.get()).toBeNull();
    expect(await storage.get(STORAGE_KEYS.session)).toBeNull();
    expect(await storage.get(STORAGE_KEYS.user)).toBeNull();
    expect(store.getState().auth).toEqual({
      status: 'signedOut',
      user: null,
      submitting: false,
      notice: null,
    });
    // Google forgets the account chosen last time, too.
    expect(signOutOfGoogle).toHaveBeenCalled();
  });

  it('flags a wrong password and keeps the session', async () => {
    installServer();
    const store = signedInStore();

    const result = await store.dispatch(
      deleteAccount({ password: 'wrong-password' }),
    );

    expect(result).toMatchObject({
      type: deleteAccount.rejected.type,
      payload: 'Incorrect password',
      meta: { wrongPassword: true },
    });
    expect(session.get()).not.toBeNull();
    expect(await storage.get(STORAGE_KEYS.user)).toEqual(user);
    expect(store.getState().auth.status).toBe('signedIn');
  });

  it('reports an unreachable server as a message, not a wrong password', async () => {
    api.defaults.adapter = async config => {
      throw new axios.AxiosError('Network Error', 'ERR_NETWORK', config);
    };
    const store = signedInStore();

    const result = await store.dispatch(
      deleteAccount({ password: 'right-password' }),
    );

    expect(result).toMatchObject({
      type: deleteAccount.rejected.type,
      payload: expect.stringMatching(/Can't reach the DoAll server/),
      meta: { wrongPassword: false },
    });
    expect(session.get()).not.toBeNull();
    expect(store.getState().auth.status).toBe('signedIn');
  });

  it('confirms with Google, and a refusal is not a wrong password', async () => {
    const requests = installServer();
    const store = signedInStore();

    const result = await store.dispatch(
      deleteAccount({ googleIdToken: 'another-account' }),
    );

    expect(JSON.parse(requests[0].data)).toEqual({
      googleIdToken: 'another-account',
    });
    expect(result).toMatchObject({
      type: deleteAccount.rejected.type,
      meta: { wrongPassword: false },
    });
    expect(store.getState().auth.status).toBe('signedIn');
  });
});

describe('signInWithGoogle', () => {
  const googleUser = { ...user, signInMethods: ['google'] };
  const tokens = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresIn: 900,
  };

  /** Fake POST /auth/google that answers every request with `status` and `data`. */
  function answer(status: number, data: unknown) {
    const requests: InternalAxiosRequestConfig[] = [];
    api.defaults.adapter = async config => {
      requests.push(config);
      const response: AxiosResponse = {
        data,
        status,
        statusText: '',
        headers: {},
        config,
      };
      if (status < 400) {
        return response;
      }
      throw new axios.AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        config,
        null,
        response,
      );
    };
    return requests;
  }

  beforeEach(async () => {
    await session.clear();
    await storage.remove(STORAGE_KEYS.user);
  });

  it('signs in with the ID token and keeps the session like login', async () => {
    const requests = answer(200, { user: googleUser, tokens });
    const store = configureStore({ reducer: { auth: reducer } });

    const result = await store.dispatch(
      signInWithGoogle({ idToken: 'id-token' }),
    );

    expect(result.type).toBe(signInWithGoogle.fulfilled.type);
    expect(requests[0]).toMatchObject({ method: 'post', url: '/auth/google' });
    expect(JSON.parse(requests[0].data)).toEqual({ idToken: 'id-token' });
    expect(store.getState().auth).toMatchObject({
      status: 'signedIn',
      user: googleUser,
      submitting: false,
    });
    expect(session.get()?.accessToken).toBe('access');
    expect(await storage.get(STORAGE_KEYS.user)).toEqual(googleUser);
  });

  it('reports an email/password account that needs its password first', async () => {
    answer(409, {
      statusCode: 409,
      code: 'GOOGLE_LINK_PASSWORD_REQUIRED',
      email: 'ada@example.com',
      message: 'You already have a DoAll account with this email.',
    });
    const store = configureStore({ reducer: { auth: reducer } });

    const result = await store.dispatch(
      signInWithGoogle({ idToken: 'id-token' }),
    );

    expect(result).toMatchObject({
      type: signInWithGoogle.rejected.type,
      meta: { linkEmail: 'ada@example.com', wrongPassword: false },
    });
    expect(session.get()).toBeNull();
  });

  it('flags a wrong password when connecting', async () => {
    answer(403, { statusCode: 403, message: 'Incorrect password' });
    const store = configureStore({ reducer: { auth: reducer } });

    const result = await store.dispatch(
      signInWithGoogle({ idToken: 'id-token', password: 'nope' }),
    );

    expect(result).toMatchObject({
      payload: 'Incorrect password',
      meta: { linkEmail: null, wrongPassword: true },
    });
  });
});
