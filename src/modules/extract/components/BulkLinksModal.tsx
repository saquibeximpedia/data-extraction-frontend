'use client';

import { Badge, Button, Icon, Modal, useToast } from '@/components/ui';
import { fmtMonth, plural } from '@/lib/format';
import type { BulkDownload } from '@/lib/types';

/** A month's file link from the source's pattern: {YYYYMM} → 202608 */
export const bulkUrl = (bulk: BulkDownload, period: string) => bulk.urlTemplate.replace('{YYYYMM}', period.replace('-', ''));

/**
 * Direct links to the source's monthly files for the chosen months, opened in the browser: the
 * extraction service downloads nothing and no run is started. Months after the latest one the
 * source should have out are marked, since their link may not work yet.
 */
export function BulkLinksModal({ open, onClose, bulk, periods, latest }: { open: boolean; onClose: () => void; bulk: BulkDownload; periods: string[]; latest: string }) {
  const toast = useToast();
  const links = periods.map((p) => ({ period: p, url: bulkUrl(bulk, p), name: decodeURIComponent(bulkUrl(bulk, p)).split('/').pop() ?? p }));
  const copyAll = () =>
    navigator.clipboard?.writeText(links.map((l) => l.url).join('\n')).then(
      () => toast('ok', `${plural(links.length, 'link')} copied`),
      () => toast('err', 'Could not copy the links')
    );

  return (
    <Modal open={open} onClose={onClose} title={`Bulk files · ${plural(periods.length, 'month')}`} icon={<Icon.Download size={16} />} wide>
      <p className="modal-body">{bulk.description}</p>
      <ul className="bulk-links">
        {links.map((l) => (
          <li key={l.period}>
            <span className="bulk-link-month">{fmtMonth(l.period)}</span>
            <a className="link mono bulk-link-url" href={l.url} target="_blank" rel="noreferrer" title={l.url}>
              {l.name}
            </a>
            {latest && l.period > latest && <Badge tone="amber">May not be out yet</Badge>}
            <a className="btn btn-secondary btn-sm" href={l.url} target="_blank" rel="noreferrer">
              <Icon.Download size={14} /> Download
            </a>
          </li>
        ))}
      </ul>
      <div className="modal-actions">
        <a className="link bulk-listing" href={bulk.listingUrl} target="_blank" rel="noreferrer">
          Every file Eurostat has published <Icon.External size={12} />
        </a>
        <Button size="sm" variant="secondary" icon={<Icon.Copy size={13} />} onClick={copyAll}>
          Copy {links.length > 1 ? 'all links' : 'link'}
        </Button>
        <Button size="sm" variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
