'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Icon, Spinner, ThemeToggle } from './ui';

/** Access screen: one password field, explained in terms of what this tool does */
export function Login({ onToken, notice }: { onToken: (token: string) => void; notice?: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const { token } = await api.login(password.trim());
      onToken(token);
    } catch (err) {
      if (err instanceof ApiError) {
        // The IP check fails before the password check and tells us which IP the server saw
        const ip = err.body?.clientIp ? ` Your IP as the server sees it: ${err.body.clientIp}` : '';
        setError(err.status === 403 && !err.body?.clientIp ? 'That password is not right.' : err.message + ip);
      } else {
        setError('The API server is not responding. Is it running?');
      }
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="access">
      <div className="access-grid" aria-hidden="true" />
      <div className="access-corner">
        <ThemeToggle />
      </div>

      <main className="access-body">
        <span className="access-eyebrow glass">
          <span className="dot dot-green" /> Internal tool · allow-listed IPs only
        </span>

        <h1 className="access-title">
          Customs trade data,
          <br />
          <span className="access-title-muted">pulled every month.</span>
        </h1>

        <p className="access-lead">
          Government trade statistics, extracted on a daily schedule and saved as one CSV per country and month. Enter the access password
          from the server to continue.
        </p>

        <form key={shakeKey} onSubmit={submit} className={`access-form glass ${shakeKey ? 'shake' : ''} ${error ? 'has-error' : ''}`}>
          <span className="access-form-icon">
            <Icon.Lock />
          </span>
          <input
            className="access-input"
            type="password"
            placeholder="Access password"
            aria-label="Access password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="access-go" type="submit" disabled={busy || !password.trim()} aria-label="Unlock">
            {busy ? <Spinner /> : <Icon.ArrowRight />}
          </button>
        </form>

        <p className={`access-msg ${error ? 'is-error' : ''}`} role={error ? 'alert' : undefined}>
          {error || notice || ' '}
        </p>

        <ul className="access-facts">
          <li>
            <Icon.Clock size={15} /> Checks for new months daily
          </li>
          <li>
            <Icon.Refresh size={15} /> Retries until the source publishes
          </li>
          <li>
            <Icon.File size={15} /> One CSV per country-month
          </li>
        </ul>
      </main>
    </div>
  );
}
