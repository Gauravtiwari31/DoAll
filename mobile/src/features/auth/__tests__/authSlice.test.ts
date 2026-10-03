import reducer, {
  login,
  logout,
  register,
  restoreSession,
  sessionExpired,
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
});
