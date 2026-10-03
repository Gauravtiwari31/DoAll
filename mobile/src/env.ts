/**
 * Build-time settings.
 *
 * Release builds on CI overwrite this file when the repository variable
 * `DOALL_API_URL` is set (see .github/workflows/android-apk.yml), so the APK
 * talks to the hosted API out of the box. Keep it `null` in git: local builds
 * then use the emulator address.
 */
export const HOSTED_API_URL: string | null = null;
