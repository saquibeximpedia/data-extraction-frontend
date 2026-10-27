'use client';

import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { Icon, Spinner, ThemeToggle } from './ui';

/** Sign-in screen: username and password of an account an admin created */
export function Login({ notice }: { notice?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [setupProblems, setSetupProblems] = useState<string[]>([]);

  // A deployment whose server settings don't match the browser's would reject every sign-in: say why up front
  useEffect(() => {
    if (!supabaseConfigured) return;
    const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\./i)?.[1] ?? '';
    fetch(`/api/setup?ref=${ref}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((r: { problems?: string[]; error?: string }) => setSetupProblems(r.problems ?? (r.error ? [r.error] : [])))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      // The server finds the account by username and signs in; supabase-js then keeps the session
      const res = await fetch('/api/auth/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim(), password }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error || `Sign-in failed (HTTP ${res.status})`);
      else {
        const { error: sessionError } = await supabase.auth.setSession(body);
        if (sessionError) setError(sessionError.message);
      }
    } catch {
      setError('The server did not respond.');
    }
    // On success the app switches to the dashboard once the API accepts the session
    setBusy(false);
  }

  const message = !supabaseConfigured
    ? 'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
    : error || notice;

  return (
    <div className="signin">
      <div className="signin-corner">
        <ThemeToggle />
      </div>

      <main className="signin-body">
        <form onSubmit={submit} className="signin-card">
          <div>
            <h1 className="signin-title">Sign in</h1>
            <p className="signin-sub">Use the account an admin created for you.</p>
          </div>
          <label className="signin-field">
            <span>Username</span>
            <input className="control" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="signin-field">
            <span>Password</span>
            <input className="control" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {message && (
            <p className={`signin-msg ${error || !supabaseConfigured ? 'is-error' : ''}`} role={error ? 'alert' : undefined}>
              {message}
            </p>
          )}
          <button className="btn btn-primary btn-md signin-go" type="submit" disabled={busy || !username.trim() || !password || !supabaseConfigured}>
            {busy && <Spinner />} Sign in
          </button>
        </form>

        {setupProblems.length > 0 && (
          <div className="note note-error setup-problems" role="alert">
            <Icon.Alert />
            <span>
              <b>This deployment can't sign anyone in yet.</b> Fix these settings on the server, then redeploy:
              <ul>
                {setupProblems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
