import { Platform } from 'react-native';

/**
 * Where the DoAll API lives.
 *
 * - Android emulator: `10.0.2.2` is an alias for your computer's `localhost`.
 * - Physical device over USB: run `adb reverse tcp:3000 tcp:3000` and set
 *   DEV_HOST to 'localhost', or use your computer's LAN IP (e.g. 192.168.1.20).
 */
const DEV_HOST = Platform.select({ android: '10.0.2.2', default: 'localhost' });
const DEV_PORT = 3000;

export const API_URL = `http://${DEV_HOST}:${DEV_PORT}/api`;

/** Abort requests that hang (bad Wi-Fi, server down) instead of spinning forever. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Refresh the access token this long before it actually expires. */
export const TOKEN_REFRESH_MARGIN_MS = 30_000;
