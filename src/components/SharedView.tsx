'use client';

import { useEffect, useState } from 'react';
import { ApiError, errorText, publicShare } from '@/lib/api';
import { fmtDate, fmtSize, plural } from '@/lib/format';
import type { PublicShare } from '@/lib/types';
import { Button, FileIcon, Icon, Spinner, ThemeToggle } from './ui';

/**
 * The page anyone with a share link sees (no sign-in): the password first if the link has one,
 * then its files to download one by one or all as a zip.
 */
export function SharedView({ id }: { id: string }) {
  const [share, setShare] = useState<PublicShare | null>(null);
  const [loadError, setLoadError] = useState('');
  const [password, setPassword] = useState('');
  // The password that unlocked the link; sent again with each download
  const [unlockedWith, setUnlockedWith] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    publicShare.get(id).then(setShare, (err) => setLoadError(errorText(err)));
  }, [id]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy('unlock');
    setError('');
    try {
      setShare(await publicShare.unlock(id, password));
      setUnlockedWith(password);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function download(path?: string) {
    setBusy(path ?? 'all');
    setError('');
    try {
      if (path) await publicShare.download(id, path, unlockedWith);
      else await publicShare.downloadAll(id, unlockedWith);
    } catch (err) {
      // The link was removed or expired while the page was open
      if (err instanceof ApiError && (err.status === 404 || err.status === 410) && !path) setLoadError(err.message);
      else setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  let card: React.ReactNode;
  if (loadError) {
    card = (
      <div className="signin-card">
        <div>
          <h1 className="signin-title">Link unavailable</h1>
          <p className="signin-sub">{loadError}</p>
        </div>
        <p className="signin-msg">Ask the person who sent it for a new link.</p>
      </div>
    );
  } else if (!share) {
    card = (
      <div className="signin-card" aria-busy="true">
        <Spinner />
      </div>
    );
  } else if (share.locked) {
    card = (
      <form className="signin-card" onSubmit={unlock}>
        <div>
          <h1 className="signin-title">{share.title || 'Shared files'}</h1>
          <p className="signin-sub">This link is protected. Enter the password you were given.</p>
        </div>
        <label className="signin-field">
          <span>Password</span>
          <input className="control" type="password" autoComplete="off" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && (
          <p className="signin-msg is-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-md signin-go" type="submit" disabled={busy === 'unlock' || !password}>
          {busy === 'unlock' ? <Spinner /> : <Icon.Lock size={15} />} Unlock
        </button>
      </form>
    );
  } else {
    const total = share.files.reduce((n, f) => n + f.size, 0);
    card = (
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
        {error && (
          <p className="signin-msg is-error" role="alert">
            {error}
          </p>
        )}
        {share.files.length > 1 && (
          <Button variant="primary" className="signin-go" icon={<Icon.Archive size={15} />} loading={busy === 'all'} onClick={() => download()}>
            Download all as zip
          </Button>
        )}
        <div className="shared-foot">
          <span>{share.expiresAt ? `Available until ${fmtDate(share.expiresAt)}` : 'This link does not expire'}</span>
          {share.hasPassword && (
            <span>
              <Icon.Lock size={12} /> Password protected
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="signin">
      <div className="signin-corner">
        <ThemeToggle />
      </div>
      <main className="signin-body shared-body">{card}</main>
    </div>
  );
}
