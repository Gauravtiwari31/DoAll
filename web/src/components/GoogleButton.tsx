import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../config';

/** The parts of Google Identity Services used here. */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        ux_mode?: 'popup' | 'redirect';
      }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let loading: Promise<GoogleIdentity> | null = null;

function loadGoogleIdentity(): Promise<GoogleIdentity> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('no google')));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Couldn't load Google sign-in"));
    };
    document.head.append(script);
  });
  return loading;
}

/** Google allows one initialization per page; its callback goes to the mounted button. */
let initialized = false;
let handler: ((credential: string) => void) | null = null;

/**
 * Google's own "Continue with Google" button. It hands back an ID token issued
 * to the server's OAuth client, which the server checks (POST /auth/google),
 * the same as the app does. Renders nothing in builds without a client ID.
 */
export function GoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const latest = useRef(onCredential);
  latest.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return;
    }
    let cancelled = false;
    loadGoogleIdentity()
      .then(google => {
        const parent = container.current;
        if (cancelled || !parent) {
          return;
        }
        handler = credential => latest.current(credential);
        if (!initialized) {
          initialized = true;
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID!,
            callback: ({ credential }) => handler?.(credential),
            ux_mode: 'popup',
          });
        }
        google.accounts.id.renderButton(parent, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          width: Math.min(Math.max(parent.clientWidth, 200), 400),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }
  return failed ? (
    <p className="hint">Google sign-in couldn't load here. Use your email and password instead.</p>
  ) : (
    <div ref={container} className="google-button" />
  );
}
