'use client';

import { useState } from 'react';
import { Button, FileIcon, Icon, Spinner, When } from '@/components/ui';
import { saveFrom, saveResponse } from '@/lib/download';
import { fmtSize, plural } from '@/lib/format';
import { AppError, errorText } from '@/lib/result';
import type { PublicShare } from '@/lib/types';
import { unlockShare } from '../actions';

/** A message on its own card, e.g. why the link can't be opened */
function Unavailable({ message }: { message: string }) {
  return (
    <div className="signin-card">
      <div>
        <h1 className="signin-title">Link unavailable</h1>
        <p className="signin-sub">{message}</p>
      </div>
      <p className="signin-msg">Ask the person who sent it for a new link.</p>
    </div>
  );
}

/**
 * What anyone with a share link sees (no sign-in): the password first if the link has one, then
 * its files to download one by one or all as a zip. `share` is null when the link is gone (`error` says why).
 */
export function SharedFiles({ id, share: initial, error: loadError }: { id: string; share: PublicShare | null; error: string }) {
  const [share, setShare] = useState(initial);
  const [gone, setGone] = useState(loadError);
  const [password, setPassword] = useState('');
  // The password that unlocked the link; sent again with each download
  const [unlockedWith, setUnlockedWith] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy('unlock');
    setError('');
    const result = await unlockShare(id, password);
    if (result.ok) {
      setShare(result.data);
      setUnlockedWith(password);
    } else setError(result.error);
    setBusy(null);
  }

  async function download(path?: string) {
    setBusy(path ?? 'all');
    setError('');
    const url = `/api/public/shares/${encodeURIComponent(id)}/download`;
    try {
      if (path) {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, password: unlockedWith }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new AppError(body.error || `Request failed (HTTP ${res.status})`, res.status);
        saveFrom(body.url);
      } else await saveResponse(url, { password: unlockedWith }, 'shared-files.zip');
    } catch (err) {
      // The link was removed or expired while the page was open
      if (err instanceof AppError && (err.status === 404 || err.status === 410) && !path) setGone(err.message);
      else setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  if (gone || !share) return <Unavailable message={gone || 'This link does not exist or has been removed.'} />;

  const errorLine = error && (
    <p className="signin-msg is-error" role="alert">
      {error}
    </p>
  );

  if (share.locked) {
    return (
      <form className="signin-card" onSubmit={unlock}>
        <div>
          <h1 className="signin-title">{share.title || 'Shared files'}</h1>
          <p className="signin-sub">This link is protected. Enter the password you were given.</p>
        </div>
        <label className="signin-field">
          <span>Password</span>
          <input className="control" type="password" autoComplete="off" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {errorLine}
        <button className="btn btn-primary btn-md signin-go" type="submit" disabled={busy === 'unlock' || !password}>
          {busy === 'unlock' ? <Spinner /> : <Icon.Lock size={15} />} Unlock
        </button>
      </form>
    );
  }

  const total = share.files.reduce((n, f) => n + f.size, 0);
  return (
    <div className="signin-card shared-card">
      <div>
        <h1 className="signin-title">{share.title || 'Shared files'}</h1>
        <p className="signin-sub">
          {plural(share.files.length, 'file')} · {fmtSize(total)}
        </p>
      </div>
      <ul className="file-list">
        {share.files.map((f) => (
          <li key={f.path} className="file-row">
            <FileIcon name={f.name} />
            <span className="file-row-text">
              <span className="file-row-name" title={f.name}>
                {f.name}
              </span>
              <span className="file-row-meta">{fmtSize(f.size)}</span>
            </span>
            <span className="file-row-actions">
              <Button size="sm" variant="ghost" iconOnly aria-label={`Download ${f.name}`} title="Download" loading={busy === f.path} icon={<Icon.Download size={16} />} onClick={() => download(f.path)} />
            </span>
          </li>
        ))}
      </ul>
      {errorLine}
      {share.files.length > 1 && (
        <Button variant="primary" className="signin-go" icon={<Icon.Archive size={15} />} loading={busy === 'all'} onClick={() => download()}>
          Download all as zip
        </Button>
      )}
      <div className="shared-foot">
        <span>{share.expiresAt ? (
            <>
              Available until <When value={share.expiresAt} />
            </>
          ) : (
            'This link does not expire'
          )}</span>
        {share.hasPassword && (
          <span>
            <Icon.Lock size={12} /> Password protected
          </span>
        )}
      </div>
    </div>
  );
}
