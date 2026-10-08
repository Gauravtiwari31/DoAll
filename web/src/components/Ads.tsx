import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT, ADSENSE_SLOT, PLAY_STORE_URL } from '../config';
import { Icon } from './Icon';

declare global {
  interface Window {
    adsbygoogle?: object[];
  }
}

export const adsEnabled = Boolean(ADSENSE_CLIENT && ADSENSE_SLOT);

/**
 * One responsive Google AdSense display ad. The AdSense script itself is in
 * the page's HTML (vite.config.ts); this asks it to fill the slot.
 */
function AdSlot() {
  const slot = useRef<HTMLModElement>(null);

  useEffect(() => {
    const ins = slot.current;
    // Filled already (React runs effects twice in development).
    if (!ins || ins.dataset.adsbygoogleStatus) {
      return;
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Blocked by an ad blocker, or no ad to show: the slot stays empty.
    }
  }, []);

  return (
    <div className="ad">
      <span className="ad-label">Advertisement</span>
      <ins
        ref={slot}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT!}
        data-ad-slot={ADSENSE_SLOT!}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

/**
 * "Don't want to see ads? Switch to the app." The Android app has no ads,
 * and the same account brings the same tasks along. Until the Play Store
 * listing is public (VITE_PLAY_STORE_URL) the button says it's coming.
 */
export function AppPromo({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`promo${compact ? ' promo-compact' : ''}`}>
      <span className="promo-icon">
        <Icon name="phone" size={22} />
      </span>
      <div className="promo-text">
        <strong>{adsEnabled ? "Don't want to see ads?" : 'Take DoAll with you'}</strong>
        <span>
          {adsEnabled ? 'Switch to the DoAll app for Android: no ads, ' : 'The Android app adds '}
          reminders that ring on time, and it works offline. Sign in with the same account and your
          tasks are already there.
        </span>
      </div>
      {PLAY_STORE_URL ? (
        <a className="btn btn-ink" href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
          Get it on Google Play
        </a>
      ) : (
        <span className="btn btn-ghost" aria-disabled="true">
          Coming soon to Google Play
        </span>
      )}
    </aside>
  );
}

/** An ad (when AdSense is set up) with the switch to the ad-free app under it. */
export function AdBreak({ compact = false }: { compact?: boolean }) {
  return (
    <div className="ad-break">
      {adsEnabled && <AdSlot />}
      <AppPromo compact={compact} />
    </div>
  );
}
