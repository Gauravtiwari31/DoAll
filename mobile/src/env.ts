/**
 * Build-time settings.
 *
 * Release builds on CI rewrite this file from repository variables (see
 * .github/workflows/android-apk.yml): `DOALL_API_URL` makes the APK talk to
 * the hosted API out of the box, and `DOALL_GOOGLE_WEB_CLIENT_ID` turns on
 * "Continue with Google". Keep both `null` in git: local builds then use the
 * emulator address and hide Google sign-in.
 */
export const HOSTED_API_URL: string | null = null;

/**
 * Client ID of the server's Google OAuth client of type "Web application"
 * (it ends in .apps.googleusercontent.com). Not a secret: it's the same value
 * as GOOGLE_CLIENT_ID on the server. See docs/google-sign-in.md.
 */
export const GOOGLE_WEB_CLIENT_ID: string | null = null;

/**
 * Sentry DSN for crash reports (DOALL_SENTRY_DSN). Null: no crash reporting.
 * Not a secret: it only lets the app send reports to that project.
 */
export const SENTRY_DSN: string | null = null;
