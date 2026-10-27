'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';
import { signIn } from '../actions';

/** Username and password of an account an admin created; `disabled` while the deployment can't sign anyone in */
export function LoginForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setError('');
    const result = await signIn(username.trim(), password).catch(() => ({ ok: false as const, error: 'The server did not respond.' }));
    if (result.ok) router.replace('/');
    else {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
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
      {error && (
        <p className="signin-msg is-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-md signin-go" type="submit" disabled={busy || disabled || !username.trim() || !password}>
        {busy && <Spinner />} Sign in
      </button>
    </form>
  );
}
