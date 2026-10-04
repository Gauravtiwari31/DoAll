import { Platform } from 'react-native';
import { version } from '../package.json';
import { HOSTED_API_URL } from './env';
import { normalizeApiUrl, siteOrigin } from './utils/url';

/** Set only in package.json; the Android build reads the same field. */
export const APP_VERSION: string = version;

/**
 * A backend running on your own computer, as seen from the Android emulator
 * (`10.0.2.2` is the emulator's alias for your computer's `localhost`).
 */
const DEV_HOST = Platform.select({ android: '10.0.2.2', default: 'localhost' });
export const LOCAL_API_URL = `http://${DEV_HOST}:3000/api`;

/**
 * Address the app uses until someone changes it from the welcome screen's
 * server button: the hosted API when the build was given one (env.ts),
 * otherwise the local backend. See services/server.ts.
 */
export const DEFAULT_API_URL =
  (HOSTED_API_URL && normalizeApiUrl(HOSTED_API_URL)) || LOCAL_API_URL;

/**
 * Web pages served by the server this build was made for (hosted API in
 * release builds, local backend in dev builds). They don't follow a server
 * picked at runtime: the privacy policy belongs to the published app, and
 * someone's own server is outside it.
 */
const SITE_URL = siteOrigin(DEFAULT_API_URL);
export const PRIVACY_POLICY_URL = `${SITE_URL}/privacy`;
export const ACCOUNT_DELETION_URL = `${SITE_URL}/account/delete`;

/**
 * Abort requests that hang (bad Wi-Fi, server down) instead of spinning
 * forever. Generous because a free-tier host can take ~30 s to wake up.
 */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Refresh the access token this long before it actually expires. */
export const TOKEN_REFRESH_MARGIN_MS = 30_000;
