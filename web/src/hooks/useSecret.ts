import { useCallback, useEffect, useRef, useState } from 'react';
import { storage, STORAGE_KEYS } from '../storage';

/** ↑ ↑ ↓ ↓ ← → ← → B A */
const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];
/** Or tap the logo this many times in quick succession (for phones). */
const TAPS = 7;
const TAP_WINDOW_MS = 3_000;

/**
 * The website's secret: Focus mode. It stays hidden until someone types the
 * Konami code anywhere on the site, or taps the DoAll logo seven times.
 * Unlocking is remembered in this browser.
 */
export function useSecret(onUnlock: () => void) {
  const [unlocked, setUnlocked] = useState(() => storage.get(STORAGE_KEYS.focusUnlocked) === '1');
  const progress = useRef(0);
  const taps = useRef<number[]>([]);
  const onUnlockRef = useRef(onUnlock);
  onUnlockRef.current = onUnlock;

  const unlockedRef = useRef(unlocked);

  const unlock = useCallback(() => {
    if (unlockedRef.current) {
      return;
    }
    unlockedRef.current = true;
    storage.set(STORAGE_KEYS.focusUnlocked, '1');
    setUnlocked(true);
    onUnlockRef.current();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === KONAMI[progress.current]) {
        progress.current++;
        if (progress.current === KONAMI.length) {
          progress.current = 0;
          unlock();
        }
      } else {
        progress.current = key === KONAMI[0] ? 1 : 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [unlock]);

  const tapLogo = useCallback(() => {
    const now = Date.now();
    taps.current = [...taps.current.filter(at => now - at < TAP_WINDOW_MS), now];
    if (taps.current.length >= TAPS) {
      taps.current = [];
      unlock();
    }
  }, [unlock]);

  return { unlocked, tapLogo };
}
