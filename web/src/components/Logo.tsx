/** The app icon's mark: a ticked card with the lime dot, plus the name. */
export function Logo({ onTap }: { onTap?: () => void }) {
  return (
    <button type="button" className="logo" onClick={onTap} aria-label="DoAll">
      <svg viewBox="0 0 48 48" width="36" height="36" aria-hidden="true">
        <rect x="3" y="3" width="42" height="42" rx="12" fill="var(--signal)" />
        <rect x="11" y="13" width="26" height="26" rx="7" fill="var(--ink-fixed)" />
        <rect x="9" y="10" width="26" height="26" rx="7" fill="#FFFCF6" stroke="var(--ink-fixed)" strokeWidth="3" />
        <path d="M15 23l5 5 9-10" fill="none" stroke="var(--ink-fixed)" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="35" cy="11" r="5" fill="var(--lime)" stroke="var(--ink-fixed)" strokeWidth="2.5" />
      </svg>
      <span className="logo-word">DoAll</span>
    </button>
  );
}
