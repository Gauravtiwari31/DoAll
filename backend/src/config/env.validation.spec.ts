import { validateEnv } from './env.validation';

const strong = (c: string) => c.repeat(32);

describe('validateEnv', () => {
  it('accepts a valid configuration', () => {
    const env = { JWT_ACCESS_SECRET: strong('a'), JWT_REFRESH_SECRET: strong('b'), PORT: '3000' };
    expect(validateEnv(env)).toBe(env);
  });

  it('rejects a non-numeric TRUST_PROXY', () => {
    const env = { JWT_ACCESS_SECRET: strong('a'), JWT_REFRESH_SECRET: strong('b') };
    expect(() => validateEnv({ ...env, TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/);
    expect(validateEnv({ ...env, TRUST_PROXY: '1' })).toBeDefined();
  });

  it('rejects missing, short or identical secrets', () => {
    expect(() => validateEnv({})).toThrow(/JWT_ACCESS_SECRET is required/);
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'x', JWT_REFRESH_SECRET: strong('b') })).toThrow(
      /at least 32/,
    );
    expect(() =>
      validateEnv({ JWT_ACCESS_SECRET: strong('a'), JWT_REFRESH_SECRET: strong('a') }),
    ).toThrow(/must be different/);
  });

  describe('Google sign-in', () => {
    const env = { JWT_ACCESS_SECRET: strong('a'), JWT_REFRESH_SECRET: strong('b') };
    const clientId = '1234-abc.apps.googleusercontent.com';

    it('is optional, and blank values count as unset', () => {
      expect(validateEnv(env)).toBeDefined();
      expect(
        validateEnv({ ...env, GOOGLE_CLIENT_ID: ' ', GOOGLE_CLIENT_SECRET: '' }),
      ).toBeDefined();
      expect(validateEnv({ ...env, GOOGLE_CLIENT_ID: clientId })).toBeDefined();
      expect(
        validateEnv({ ...env, GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: 'GOCSPX-x' }),
      ).toBeDefined();
    });

    it('rejects something that is not an OAuth client ID', () => {
      expect(() => validateEnv({ ...env, GOOGLE_CLIENT_ID: 'my-project-123' })).toThrow(
        /GOOGLE_CLIENT_ID must be the client ID of a "Web application" OAuth client/,
      );
    });

    it('rejects a client secret without its client ID', () => {
      expect(() => validateEnv({ ...env, GOOGLE_CLIENT_SECRET: 'GOCSPX-x' })).toThrow(
        /GOOGLE_CLIENT_SECRET is set but GOOGLE_CLIENT_ID is not/,
      );
    });
  });
});
