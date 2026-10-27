'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Field, Icon, Modal, Select, useToast } from '@/components/ui';
import { fmtDate, plural } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { unwrap } from '@/lib/result';
import type { Share } from '@/lib/types';
import { createShare } from '@/modules/shares/actions';

type Expiry = '1' | '7' | '30' | 'never';

const EXPIRY_OPTIONS: { value: Expiry; label: string }[] = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'never', label: 'Never' },
];

/** The address people open for a share link */
const shareUrl = (id: string) => `${window.location.origin}/s/${id}`;

export function useCopyLink() {
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
      () => unwrap(createShare({ paths, title: title.trim() || undefined, password: protect ? password : undefined, expiresInDays: expiry === 'never' ? null : Number(expiry) })),
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
          {created.hasPassword && <p className="field-help">Send the password separately from the link. It can&apos;t be shown again.</p>}
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
