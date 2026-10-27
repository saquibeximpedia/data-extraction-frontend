'use client';

import { useState } from 'react';
import { Badge, Button, ConfirmModal, Empty, Icon, When } from '@/components/ui';
import { fmtSize, plural } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { unwrap } from '@/lib/result';
import type { Share } from '@/lib/types';
import { deleteShare } from '@/modules/shares/actions';
import { useCopyLink } from './ShareModal';

const shareTitle = (s: Share) => s.title || (s.files.length === 1 ? s.files[0].name : plural(s.files.length, 'file'));

/** Every share link, each with Copy and Remove; `error` when they could not be listed */
export function SharesList({ shares, error }: { shares: Share[]; error: string }) {
  const copy = useCopyLink();
  const [toRemove, setToRemove] = useState<Share | null>(null);
  const { busy: removing, run } = useAction();

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
  if (!shares.length) return <Empty>No share links yet. Select files and choose Share link to make one.</Empty>;

  return (
    <>
      <ul className="file-list">
        {shares.map((s) => (
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
                {s.expiresAt ? (
                  <>
                    {s.expired ? 'expired' : 'expires'} <When value={s.expiresAt} />
                  </>
                ) : (
                  'never expires'
                )}{' '}
                · {plural(s.downloadCount, 'download')}
                {s.lastDownloadAt && (
                  <>
                    {' (last '}
                    <When value={s.lastDownloadAt} as="relative" />)
                  </>
                )}{' '}
                · by {s.createdBy || 'unknown'} <When value={s.createdAt} as="relative" />
              </span>
            </span>
            <span className="file-row-actions">
              {!s.expired && <Button size="sm" variant="ghost" iconOnly aria-label="Copy link" title="Copy link" icon={<Icon.Copy size={16} />} onClick={() => copy(s.id)} />}
              <Button size="sm" variant="ghost" iconOnly className="btn-danger-ghost" aria-label="Remove link" title="Remove link" icon={<Icon.Trash size={16} />} onClick={() => setToRemove(s)} />
            </span>
          </li>
        ))}
      </ul>

      <ConfirmModal
        open={Boolean(toRemove)}
        onClose={() => setToRemove(null)}
        onConfirm={() => toRemove && run(() => unwrap(deleteShare(toRemove.id)), 'Link removed', () => setToRemove(null), 'Could not remove the link')}
        title="Remove link?"
        description={<>The link stops working straight away for anyone who has it. The files themselves stay in storage.</>}
        confirmLabel="Remove link"
        confirmVariant="danger"
        loading={removing}
      />
    </>
  );
}
