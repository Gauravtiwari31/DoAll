/**
 * Fails fast on boot when required environment variables are missing or weak,
 * instead of surfacing as confusing JWT errors at request time.
 */
const REQUIRED = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;
const MIN_SECRET_LENGTH = 32;
const GOOGLE_CLIENT_ID_PATTERN = /^[\w-]+\.apps\.googleusercontent\.com$/;

export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const problems: string[] = [];

  for (const key of REQUIRED) {
    const value = env[key];
    if (typeof value !== 'string' || value.length === 0) {
      problems.push(`${key} is required`);
    } else if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${key} must be at least ${MIN_SECRET_LENGTH} characters`);
    }
  }

  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }

  if (env.PORT !== undefined && Number.isNaN(Number(env.PORT))) {
    problems.push('PORT must be a number');
  }

  const proxy = env.TRUST_PROXY;
  if (proxy !== undefined && !(typeof proxy === 'string' && /^\d+$/.test(proxy))) {
    problems.push('TRUST_PROXY must be a whole number (hops), e.g. 1');
  }

  // Google sign-in is optional. A blank value counts as unset.
  const googleClientId =
    typeof env.GOOGLE_CLIENT_ID === 'string' ? env.GOOGLE_CLIENT_ID.trim() : '';
  const googleSecret =
    typeof env.GOOGLE_CLIENT_SECRET === 'string' ? env.GOOGLE_CLIENT_SECRET.trim() : '';
  if (googleClientId && !GOOGLE_CLIENT_ID_PATTERN.test(googleClientId)) {
    problems.push(
      'GOOGLE_CLIENT_ID must be the client ID of a "Web application" OAuth client, ending in .apps.googleusercontent.com',
    );
  }
  if (googleSecret && !googleClientId) {
    problems.push('GOOGLE_CLIENT_SECRET is set but GOOGLE_CLIENT_ID is not');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
  }
  return env;
}
