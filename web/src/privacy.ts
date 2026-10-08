import { ACCOUNT_DELETION_URL, APP_PRIVACY_URL } from './config';

// The page is static HTML; point its links at the server this build uses.
document.querySelectorAll<HTMLAnchorElement>('#app-policy, .app-policy-link').forEach(link => {
  link.href = APP_PRIVACY_URL;
});
document.querySelector<HTMLAnchorElement>('#delete-link')?.setAttribute('href', ACCOUNT_DELETION_URL);
