#!/usr/bin/env node
/**
 * Writes src/env.ts for a release build from environment variables (CI sets
 * them from repository variables; see .github/workflows/android-apk.yml):
 *
 *   DOALL_API_URL               the hosted API, e.g. https://doall-api.onrender.com
 *                               (unset: the app defaults to a local backend)
 *   DOALL_GOOGLE_WEB_CLIENT_ID  the server's Google OAuth client ID
 *                               (unset: no "Continue with Google")
 *   DOALL_SENTRY_DSN            Sentry DSN for crash reports
 *                               (unset: no crash reporting)
 *
 * Usage, from mobile/:  node scripts/write-build-env.mjs
 * For a local release build, run it with those variables set and restore
 * src/env.ts afterwards (git checkout src/env.ts); don't commit the result.
 */
import { writeFileSync } from 'node:fs';

const setting = name => process.env[name]?.trim() || null;

const apiUrl = setting('DOALL_API_URL');
const googleClientId = setting('DOALL_GOOGLE_WEB_CLIENT_ID');
const sentryDsn = setting('DOALL_SENTRY_DSN');

if (
  googleClientId &&
  !/^[\w-]+\.apps\.googleusercontent\.com$/.test(googleClientId)
) {
  console.log(
    '::error::DOALL_GOOGLE_WEB_CLIENT_ID must be the client ID of the "Web application" OAuth client ' +
      '(it ends in .apps.googleusercontent.com). See docs/google-sign-in.md.',
  );
  process.exit(1);
}

if (sentryDsn && !/^https:\/\/[^@\s]+@[^/\s]+\/\d+$/.test(sentryDsn)) {
  console.log(
    '::error::DOALL_SENTRY_DSN must be a Sentry DSN like https://abc123@o1.ingest.sentry.io/456 (Project settings → Client Keys).',
  );
  process.exit(1);
}

const source = `// Written by scripts/write-build-env.mjs for this build. See the version in git for details.
export const HOSTED_API_URL: string | null = ${JSON.stringify(apiUrl)};
export const GOOGLE_WEB_CLIENT_ID: string | null = ${JSON.stringify(
  googleClientId,
)};
export const SENTRY_DSN: string | null = ${JSON.stringify(sentryDsn)};
`;
writeFileSync(new URL('../src/env.ts', import.meta.url), source);
process.stdout.write(source);
