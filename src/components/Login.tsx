'use client';

import { useState } from 'react';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { Icon, Spinner, ThemeToggle } from './ui';

/** Sign-in screen: email and password of an account an admin created */
export function Login({ notice }: { notice?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(/invalid login/i.test(signInError.message) ? 'That email and password don’t match an account.' : signInError.message);
      setShakeKey((k) => k + 1);
    }
    // On success the app switches to the dashboard once the API accepts the session
    setBusy(false);
  }

  return (
    <div className="access">
      <div className="access-grid" aria-hidden="true" />
      <div className="access-corner">
        <ThemeToggle />
      </div>

      <main className="access-body">
        <span className="access-eyebrow glass">
          <span className="dot dot-green" /> Internal tool · accounts are created by an admin
        </span>

        <h1 className="access-title">
          Customs trade data,
          <br />
          <span className="access-title-muted">by country and month.</span>
        </h1>

        <p className="access-lead">
          Track which months are complete for each country, run extractions from government sources, and download the files.
        </p>

        <form key={shakeKey} onSubmit={submit} className={`signin-form glass ${shakeKey ? 'shake' : ''} ${error ? 'has-error' : ''}`}>
          <label className="signin-field">
            <span>Email</span>
            <input
              className="control"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="signin-field">
            <span>Password</span>
            <input
              className="control"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="btn btn-primary btn-md signin-go" type="submit" disabled={busy || !email.trim() || !password || !supabaseConfigured}>
            {busy ? <Spinner /> : <Icon.ArrowRight />} Sign in
          </button>
        </form>

        <p className={`access-msg ${error || !supabaseConfigured ? 'is-error' : ''}`} role={error ? 'alert' : undefined}>
          {!supabaseConfigured
            ? 'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
            : error || notice || ' '}
        </p>

        <ul className="access-facts">
          <li>
            <Icon.Calendar size={15} /> Completed months per country
          </li>
          <li>
            <Icon.Play size={15} /> Extractions run on the server
          </li>
          <li>
            <Icon.File size={15} /> One file per country-month
          </li>
        </ul>
      </main>
    </div>
  );
}
