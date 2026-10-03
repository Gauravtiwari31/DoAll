import { Platform } from 'react-native';

/**
 * Default address of the DoAll API. `10.0.2.2` is how the Android emulator
 * reaches your computer's `localhost`.
 *
 * On a physical phone, set the address in the app instead (the "Server"
 * button on the welcome screen), e.g. `http://192.168.1.20:3000/api` — your
 * computer's LAN IP. See services/server.ts.
 */
const DEV_HOST = Platform.select({ android: '10.0.2.2', default: 'localhost' });
const DEV_PORT = 3000;

export const DEFAULT_API_URL = `http://${DEV_HOST}:${DEV_PORT}/api`;

/** Abort requests that hang (bad Wi-Fi, server down) instead of spinning forever. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Refresh the access token this long before it actually expires. */
export const TOKEN_REFRESH_MARGIN_MS = 30_000;
