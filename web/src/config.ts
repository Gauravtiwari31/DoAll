const read = (value: string | undefined) => value?.trim() || null;

/** The DoAll API; the hosted one unless the build names another. */
export const API_URL = (
  read(import.meta.env.VITE_API_URL) ?? 'https://doall-api-m1yy.onrender.com/api'
).replace(/\/+$/, '');

/** The API's own web pages: the app's privacy policy and account deletion. */
export const SERVER_SITE = API_URL.replace(/\/api$/, '');
export const APP_PRIVACY_URL = `${SERVER_SITE}/privacy`;
export const ACCOUNT_DELETION_URL = `${SERVER_SITE}/account/delete`;

/** The server's Google OAuth client ID; null hides "Continue with Google". */
export const GOOGLE_CLIENT_ID = read(import.meta.env.VITE_GOOGLE_CLIENT_ID);

/** Google AdSense publisher (ca-pub-...) and ad unit; ads only show with both. */
export const ADSENSE_CLIENT = read(import.meta.env.VITE_ADSENSE_CLIENT);
export const ADSENSE_SLOT = read(import.meta.env.VITE_ADSENSE_SLOT);

/** The app's Google Play page, once it's published; null shows "coming soon". */
export const PLAY_STORE_URL = read(import.meta.env.VITE_PLAY_STORE_URL);

export const CONTACT_EMAIL = 'gauravt9431@gmail.com';
