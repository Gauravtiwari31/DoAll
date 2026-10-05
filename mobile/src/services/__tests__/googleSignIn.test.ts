import type { Spec } from '../../native/NativeGoogleSignIn';

const CLIENT_ID = '1234-abc.apps.googleusercontent.com';

/**
 * Loads googleSignIn afresh with the client ID a build would have (env.ts)
 * and a stand-in for the native module, or none at all (iOS).
 */
function load({
  clientId = CLIENT_ID,
  native = true,
}: { clientId?: string | null; native?: boolean } = {}) {
  jest.resetModules();
  jest.doMock('../../env', () => ({
    HOSTED_API_URL: null,
    GOOGLE_WEB_CLIENT_ID: clientId,
  }));
  jest.doMock('../../native/NativeGoogleSignIn', () => ({
    __esModule: true,
    default: native
      ? { signIn: jest.fn(), signOut: jest.fn(() => Promise.resolve()) }
      : null,
  }));
  const { googleSignIn, GoogleSignInError } = require('../googleSignIn');
  const module: jest.Mocked<Spec> =
    require('../../native/NativeGoogleSignIn').default;
  return { googleSignIn, GoogleSignInError, module };
}

afterEach(() => {
  jest.dontMock('../../env');
});

describe('googleSignIn', () => {
  it('is available only with a client ID and the native code', () => {
    expect(load().googleSignIn.isAvailable()).toBe(true);
    expect(load({ clientId: null }).googleSignIn.isAvailable()).toBe(false);
    expect(load({ clientId: '  ' }).googleSignIn.isAvailable()).toBe(false);
    expect(load({ native: false }).googleSignIn.isAvailable()).toBe(false);
  });

  it("asks Google for an ID token issued to the server's client ID", async () => {
    const { googleSignIn, module } = load();
    module.signIn.mockResolvedValue('id-token');

    await expect(googleSignIn.chooseAccount()).resolves.toBe('id-token');
    expect(module.signIn).toHaveBeenCalledWith(CLIENT_ID);
  });

  it('resolves null when the person backs out', async () => {
    const { googleSignIn, module } = load();
    module.signIn.mockRejectedValue({ code: 'cancelled' });
    await expect(googleSignIn.chooseAccount()).resolves.toBeNull();
  });

  it('turns native failures into readable errors', async () => {
    const { googleSignIn, GoogleSignInError, module } = load();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    module.signIn.mockRejectedValue({ code: 'unavailable', message: 'x' });
    const unavailable = await googleSignIn
      .chooseAccount()
      .catch((e: unknown) => e);
    expect(unavailable).toBeInstanceOf(GoogleSignInError);
    expect(unavailable).toMatchObject({
      reason: 'unavailable',
      message: expect.stringMatching(/isn't available on this phone/),
    });

    module.signIn.mockRejectedValue({ code: 'failed', message: '[28444]' });
    await expect(googleSignIn.chooseAccount()).rejects.toMatchObject({
      reason: 'failed',
      message: expect.stringMatching(/didn't work/),
    });
    warn.mockRestore();
  });

  it('refuses to start without a client ID', async () => {
    const { googleSignIn, module } = load({ clientId: null });
    await expect(googleSignIn.chooseAccount()).rejects.toMatchObject({
      reason: 'unavailable',
    });
    expect(module.signIn).not.toHaveBeenCalled();
  });

  it('signs out without ever failing', async () => {
    const { googleSignIn, module } = load();
    module.signOut.mockRejectedValue(new Error('nope'));
    await expect(googleSignIn.signOut()).resolves.toBeUndefined();
    await expect(
      load({ native: false }).googleSignIn.signOut(),
    ).resolves.toBeUndefined();
  });
});
