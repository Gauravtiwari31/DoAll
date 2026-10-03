import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Current time that ticks every `intervalMs` and when the app returns to the
 * foreground, so "overdue" / "due in 3h" labels never go stale.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setNow(Date.now());
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [intervalMs]);

  return now;
}
