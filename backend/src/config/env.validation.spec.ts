import { validateEnv } from './env.validation';

const strong = (c: string) => c.repeat(32);

describe('validateEnv', () => {
  it('accepts a valid configuration', () => {
    const env = { JWT_ACCESS_SECRET: strong('a'), JWT_REFRESH_SECRET: strong('b'), PORT: '3000' };
    expect(validateEnv(env)).toBe(env);
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
});
