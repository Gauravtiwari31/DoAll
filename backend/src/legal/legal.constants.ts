/**
 * Facts shown on the public web pages. The app and developer names must match
 * the Google Play listing, and the email is the privacy contact given there.
 */
export const APP_NAME = 'DoAll';
export const DEVELOPER_NAME = 'Gaurav Tiwari';
export const CONTACT_EMAIL = 'gauravt9431@gmail.com';
/** Change this whenever the privacy policy text changes. */
export const POLICY_EFFECTIVE_DATE = '6 October 2026';
export const SOURCE_CODE_URL = 'https://github.com/Gauravtiwari31/DoAll';

/** Served without the /api prefix (see app.setup.ts) so the store listing gets short URLs. */
export const PRIVACY_PATH = 'privacy';
export const ACCOUNT_DELETE_PATH = 'account/delete';
/** "Delete with Google": the form posts here, and Google sends the browser back to the callback. */
export const ACCOUNT_DELETE_GOOGLE_PATH = 'account/delete/google';
export const ACCOUNT_DELETE_GOOGLE_CALLBACK_PATH = 'account/delete/google/callback';
/** Pages the links in DoAll's emails open. */
export const VERIFY_EMAIL_PATH = 'verify-email';
export const RESET_PASSWORD_PATH = 'reset-password';
