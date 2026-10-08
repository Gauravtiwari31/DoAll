import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, GOOGLE_LINK_PASSWORD_REQUIRED, NetworkError } from '../api';
import { GOOGLE_CLIENT_ID } from '../config';
import { GoogleButton } from './GoogleButton';

type Mode = 'signin' | 'register' | 'forgot' | 'link';

/** Mirrors the server's rules (backend/src/auth/password-rules.ts). */
function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 72) return 'Password must be at most 72 characters';
  if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  return null;
}

const message = (error: unknown) =>
  error instanceof ApiError || error instanceof NetworkError
    ? error.message
    : 'Something went wrong. Please try again.';

/** A request taking this long is most likely the free server waking up. */
const SLOW_MS = 4_000;

/**
 * Sign in, create an account, or reset a password: the same accounts as the
 * app, so tasks follow the email address (or Google account) everywhere.
 */
export function AuthCard() {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword('');
  };

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = (idToken: string) =>
    run(async () => {
      try {
        await api.google(idToken);
      } catch (failure) {
        if (failure instanceof ApiError && failure.code === GOOGLE_LINK_PASSWORD_REQUIRED) {
          setGoogleToken(idToken);
          switchTo('link');
          return;
        }
        throw failure;
      }
    });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    switch (mode) {
      case 'signin':
        return run(() => api.login(address, password));
      case 'register': {
        const problem =
          name.trim().length < 2 ? 'Name must be at least 2 characters' : passwordProblem(password);
        if (problem) {
          setError(problem);
          return;
        }
        return run(() => api.register(name.trim(), address, password));
      }
      case 'forgot':
        return run(async () => {
          await api.forgotPassword(address);
          setNotice(`If ${address} has a DoAll account, a reset link is on its way. Check your inbox.`);
        });
      case 'link':
        return run(() => api.google(googleToken!, password));
    }
  };

  const titles: Record<Mode, string> = {
    signin: 'Sign in',
    register: 'Create your account',
    forgot: 'Reset your password',
    link: 'Connect Google',
  };

  return (
    <section className="card auth" id="sign-in" aria-labelledby="auth-title">
      {(mode === 'signin' || mode === 'register') && (
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'tab active' : 'tab'}
            onClick={() => switchTo('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => switchTo('register')}
          >
            Create account
          </button>
        </div>
      )}
      <h2 id="auth-title" className={mode === 'signin' || mode === 'register' ? 'sr-only' : ''}>
        {titles[mode]}
      </h2>

      {mode === 'link' && (
        <p className="hint">
          You already have a DoAll account with this address. Enter its password once to connect
          Google to it; after that, Google is enough.
        </p>
      )}
      {mode === 'forgot' && (
        <p className="hint">We'll email you a link to choose a new password.</p>
      )}

      <form onSubmit={submit} noValidate>
        {mode === 'register' && (
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
              maxLength={50}
              required
            />
          </label>
        )}
        {mode !== 'link' && (
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
        )}
        {mode !== 'forgot' && (
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              maxLength={72}
              required
            />
            {mode === 'register' && (
              <small>At least 8 characters, with a letter and a number.</small>
            )}
          </label>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="form-notice">{notice}</p>}
        {slow && <p className="hint">Waking up the server… the first request can take up to a minute.</p>}

        <button type="submit" className="btn btn-signal btn-wide" disabled={busy}>
          {busy
            ? 'One moment…'
            : { signin: 'Sign in', register: 'Create account', forgot: 'Send reset link', link: 'Connect and sign in' }[mode]}
        </button>
      </form>

      {mode === 'signin' && (
        <button type="button" className="link-button" onClick={() => switchTo('forgot')}>
          Forgot your password?
        </button>
      )}
      {(mode === 'forgot' || mode === 'link') && (
        <button type="button" className="link-button" onClick={() => switchTo('signin')}>
          Back to sign in
        </button>
      )}

      {GOOGLE_CLIENT_ID && (mode === 'signin' || mode === 'register') && (
        <>
          <div className="divider">
            <span>or</span>
          </div>
          <GoogleButton onCredential={signInWithGoogle} />
        </>
      )}
    </section>
  );
}
