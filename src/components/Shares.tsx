'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorText, shareUrl } from '@/lib/api';
import { fmtDate, fmtRelative, fmtSize, plural } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import type { Share } from '@/lib/types';
import { FileRowsSkeleton } from './PageSkeletons';
import { Badge, Button, ConfirmModal, Empty, Field, Icon, Modal, Select, useToast } from './ui';

type Expiry = '1' | '7' | '30' | 'never';

const EXPIRY_OPTIONS: { value: Expiry; label: string }[] = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'never', label: 'Never' },
];

const shareTitle = (s: Share) => s.title || (s.files.length === 1 ? s.files[0].name : plural(s.files.length, 'file'));

function useCopyLink() {
  const toast = useToast();
  return (id: string) =>
    navigator.clipboard?.writeText(shareUrl(id)).then(
      () => toast('ok', 'Link copied'),
      () => toast('err', 'Could not copy', 'Select the link and copy it.')
    );
}

/**
 * Popup that makes a link anyone can open to download the given files, optionally behind a
 * password and with an expiry. Once made, it shows the link to copy and calls `onCreated`.
 */
export function ShareModal({ paths, onClose, onCreated }: { paths: string[] | null; onClose: () => void; onCreated?: () => void }) {
  const copy = useCopyLink();
  const [title, setTitle] = useState('');
  const [protect, setProtect] = useState(false);
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState<Expiry>('7');
  const [created, setCreated] = useState<(Share & { reused: boolean }) | null>(null);
  const { busy, run } = useAction();

  // Each opening starts from a blank form
  useEffect(() => {
    if (!paths) return;
    setTitle('');
    setProtect(false);
    setPassword('');
    setExpiry('7');
    setCreated(null);
  }, [paths]);

  const passwordTooShort = protect && password.length < 4;

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (passwordTooShort || !paths) return;
    run(
      () => api.createShare({ paths, title: title.trim() || undefined, password: protect ? password : undefined, expiresInDays: expiry === 'never' ? null : Number(expiry) }),
      '',
      (share) => {
        setCreated(share);
        onCreated?.();
      },
      'Could not create the link'
    );
  }

  return (
    <Modal
      open={Boolean(paths)}
      onClose={onClose}
      busy={busy}
      title={created ? (created.reused ? 'You already shared these files' : 'Link ready') : `Share ${plural(paths?.length ?? 0, 'file')}`}
      icon={<Icon.Link size={18} />}
    >
      {created ? (
        <div className="share-form">
          <p className="modal-text">
            {created.reused && 'This is your existing link for the same files. '}
            Anyone with it can download {created.files.length === 1 ? 'the file' : `the ${created.files.length} files`}
            {created.hasPassword ? ' after entering the password' : ''}. {created.expiresAt ? `It stops working on ${fmtDate(created.expiresAt)}.` : 'It does not expire.'}
          </p>
          <div className="share-link">
            <input className="control mono" readOnly value={shareUrl(created.id)} aria-label="Share link" onFocus={(e) => e.target.select()} />
            <Button type="button" size="sm" variant="primary" icon={<Icon.Copy size={14} />} onClick={() => copy(created.id)}>
              Copy
            </Button>
          </div>
          {created.hasPassword && <p className="field-help">Send the password separately from the link. It can't be shown again.</p>}
          <div className="modal-center">
            <Link href="/files?view=shares" className="btn btn-ghost btn-sm" onClick={onClose}>
              All shared links <Icon.ChevronRight size={13} />
            </Link>
          </div>
        </div>
      ) : (
        <form className="share-form" onSubmit={create}>
          <Field label="Title" htmlFor="share-title" aside={<span className="field-aside">Optional</span>}>
            <input id="share-title" className="control" value={title} maxLength={120} placeholder="e.g. Indonesia Q3 2026" onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Expires after" htmlFor="share-expiry">
            <Select<Expiry> id="share-expiry" value={expiry} options={EXPIRY_OPTIONS} onChange={setExpiry} />
          </Field>
          <label className="toggle">
            <input type="checkbox" className="check" checked={protect} onChange={(e) => setProtect(e.target.checked)} /> Require a password
          </label>
          {protect && (
            <Field label="Password" htmlFor="share-password" aside={<span className="field-aside">At least 4 characters</span>}>
              <input id="share-password" className="control" type="text" autoComplete="off" autoFocus value={password} maxLength={200} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" icon={<Icon.Link size={14} />} loading={busy} disabled={passwordTooShort}>
              Create link
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Every share link, each with Copy and Remove */
export function SharesList() {
  const copy = useCopyLink();
  const [list, setList] = useState<Share[] | null>(null);
  const [error, setError] = useState('');
  const [toRemove, setToRemove] = useState<Share | null>(null);
  const { busy: removing, run } = useAction();

  const load = useCallback(() => {
    api.shares().then(
      (shares) => {
        setList(shares);
        setError('');
      },
      (err) => setError(errorText(err))
    );
  }, []);
  useEffect(load, [load]);

  function remove() {
    if (!toRemove) return;
    const id = toRemove.id;
    run(() => api.deleteShare(id), 'Link removed', () => {
      setToRemove(null);
      setList((prev) => prev?.filter((s) => s.id !== id) ?? null);
    }, 'Could not remove the link');
  }

  if (error) {
    return (
      <div className="note note-error note-tight" role="alert">
        <Icon.Alert />
        <span>
          <b>Links could not be listed.</b> {error} If the table is missing, run <span className="mono">backend/supabase/schema.sql</span> again.
        </span>
      </div>
    );
  }
  if (!list) {
    return (
    <FileRowsSkeleton rows={4} />
    );
  }
  if (!list.length) return <Empty>No share links yet. Select files and choose Share link to make one.</Empty>;

  return (
    <>
      <ul className="file-list">
        {list.map((s) => (
          <li key={s.id} className={`file-row ${s.expired ? 'is-gone' : ''}`}>
            <span className="file-icon ext-share" aria-hidden="true">
              <Icon.Link size={17} />
            </span>
            <span className="file-row-text" title={s.files.map((f) => f.path).join('\n')}>
              <span className="file-row-name">
                {shareTitle(s)}{' '}
                {s.hasPassword && (
                  <Badge tone="blue">
                    <Icon.Lock size={11} /> Password
                  </Badge>
                )}{' '}
                {s.expired && <Badge tone="red">Expired</Badge>}
              </span>
              <span className="file-row-meta">
                {plural(s.files.length, 'file')} · {fmtSize(s.files.reduce((n, f) => n + f.size, 0))} ·{' '}
                {s.expiresAt ? <span title={fmtDate(s.expiresAt)}>{s.expired ? 'expired' : 'expires'} {fmtDate(s.expiresAt)}</span> : 'never expires'} · {plural(s.downloadCount, 'download')}
                {s.lastDownloadAt ? ` (last ${fmtRelative(s.lastDownloadAt)})` : ''} · by {s.createdBy || 'unknown'} {fmtRelative(s.createdAt)}
              </span>
            </span>
            <span className="file-row-actions">
              {!s.expired && (
                <Button size="sm" variant="ghost" iconOnly aria-label="Copy link" title="Copy link" icon={<Icon.Copy size={16} />} onClick={() => copy(s.id)} />
              )}
              <Button size="sm" variant="ghost" iconOnly className="btn-danger-ghost" aria-label="Remove link" title="Remove link" icon={<Icon.Trash size={16} />} onClick={() => setToRemove(s)} />
            </span>
          </li>
        ))}
      </ul>

      <ConfirmModal
        open={Boolean(toRemove)}
        onClose={() => setToRemove(null)}
        onConfirm={remove}
        title="Remove link?"
        description={<>The link stops working straight away for anyone who has it. The files themselves stay in storage.</>}
        confirmLabel="Remove link"
        confirmVariant="danger"
        loading={removing}
      />
    </>
  );
}
