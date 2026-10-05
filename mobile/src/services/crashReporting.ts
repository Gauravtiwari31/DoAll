import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from '../config';

/**
 * Crash reporting with Sentry, only in builds given a DSN (env.ts). A report
 * says what broke and where: no screenshots, no view hierarchy, no network
 * requests, no personal data, and only screen-change breadcrumbs (other
 * breadcrumbs could carry task titles typed by the user).
 */
export function startCrashReporting(): void {
  if (!SENTRY_DSN) {
    return;
  }
  // The release name comes from the native app (package@version+code), the
  // same one the build's source map upload uses.
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableCaptureFailedRequests: false,
    beforeBreadcrumb: breadcrumb =>
      breadcrumb.category === 'navigation' ? breadcrumb : null,
  });
}
