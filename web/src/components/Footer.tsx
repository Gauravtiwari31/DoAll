import { ACCOUNT_DELETION_URL, APP_PRIVACY_URL, CONTACT_EMAIL } from '../config';

export function Footer() {
  return (
    <footer className="footer">
      <span>© {new Date().getFullYear()} DoAll</span>
      <nav aria-label="Legal">
        <a href="/privacy.html">Privacy</a>
        <a href={APP_PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          App privacy policy
        </a>
        <a href={ACCOUNT_DELETION_URL} target="_blank" rel="noopener noreferrer">
          Delete account
        </a>
        <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
      </nav>
    </footer>
  );
}
