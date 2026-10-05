import * as Sentry from '@sentry/nestjs';

/**
 * Crash reporting with Sentry, only when SENTRY_DSN is set. Imported first in
 * main.ts, before anything else loads, as Sentry requires. Only errors are
 * sent (no performance tracing), without request bodies, cookies or IP
 * addresses: a report says what broke, not who was using the app.
 */
const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT?.trim() || 'production',
    tracesSampleRate: 0,
    // Nothing about the request: bodies hold passwords, query strings hold
    // the tokens of emailed links, headers hold access tokens.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
  });
}
