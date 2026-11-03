'use client';

import { Badge, Button, Icon, Modal, useToast } from '@/components/ui';
import { fmtMonth, plural } from '@/lib/format';
import type { BulkDownload, ExtractorInfo } from '@/lib/types';

const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

/**
 * Only offers the source's files, nothing to extract: the service says so, or (older services)
 * it has bulk links but no saved HS codes to extract
 */
export const isDownloadOnly = (info: ExtractorInfo | undefined): boolean =>
  Boolean(info?.bulkDownload) && (info!.extractable === false || (!info!.allHsCodes && info!.hsCodeCount === 0 && info!.testHsCodeCount === 0));

/** A month's file link from the source's pattern: {YYYYMM} → 202608 */
export const bulkUrl = (bulk: BulkDownload, period: string) => (bulk.urlTemplate ?? '').replace('{YYYYMM}', period.replace('-', ''));

const fileName = (url: string) => decodeURIComponent(url).split('/').pop() ?? url;

/** One row of the list: a month (one file) or a year (one file per kind) */
interface Row {
  key: string;
  heading: string;
  /** Under the heading, e.g. "Jan – Sep" */
  detail?: string;
  preliminary?: boolean;
  notOut?: boolean;
  files: { label: string; url: string }[];
}

function monthRows(bulk: BulkDownload, periods: string[], latest: string): Row[] {
  return periods.map((p) => {
    const url = bulkUrl(bulk, p);
    return { key: p, heading: fmtMonth(p), notOut: Boolean(latest) && p > latest, files: [{ label: fileName(url), url }] };
  });
}

/**
 * One row per year picked. A year before the latest published month's is finished; the latest
 * one's file runs January to that month and is preliminary. A later year isn't out yet, so it
 * gets the file as it would be named for the last month picked.
 */
function yearRows(bulk: BulkDownload, periods: string[], latest: string): Row[] {
  const latestYear = latest.slice(0, 4);
  const years = [...new Set(periods.map((p) => p.slice(0, 4)))];
  return years.map((year) => {
    const finished = Boolean(latest) && year < latestYear;
    const upTo = year === latestYear ? latest : periods.filter((p) => p.startsWith(year)).pop()!;
    const month = Number(upTo.slice(5, 7));
    const files = (bulk.files ?? []).map((f) => ({
      label: f.label,
      url: finished ? f.yearTemplate.replace('{YYYY}', year) : f.partialTemplate.replace('{YYYY}', year).replace('{MONTH}', MONTH_NAMES[month - 1]),
    }));
    return {
      key: year,
      heading: year,
      detail: `Jan – ${finished ? 'Dec' : MONTH_NAMES[month - 1].slice(0, 1) + MONTH_NAMES[month - 1].slice(1, 3).toLowerCase()}`,
      preliminary: !finished,
      notOut: !latest || year > latestYear,
      files,
    };
  });
}

/**
 * Direct links to the source's files for the chosen months, opened in the browser: the
 * extraction service downloads nothing and no run is started. Months after the latest one the
 * source should have out are marked, since their link may not work yet.
 */
export function BulkLinksModal({ open, onClose, bulk, periods, latest }: { open: boolean; onClose: () => void; bulk: BulkDownload; periods: string[]; latest: string }) {
  const toast = useToast();
  const perYear = bulk.per === 'year';
  const rows = perYear ? yearRows(bulk, periods, latest) : monthRows(bulk, periods, latest);
  const urls = rows.flatMap((r) => r.files.map((f) => f.url));
  const copyAll = () =>
    navigator.clipboard?.writeText(urls.join('\n')).then(
      () => toast('ok', `${plural(urls.length, 'link')} copied`),
      () => toast('err', 'Could not copy the links')
    );

  return (
    <Modal open={open} onClose={onClose} title={`Bulk files · ${perYear ? plural(rows.length, 'year') : plural(periods.length, 'month')}`} icon={<Icon.Download size={16} />} wide>
      <p className="modal-body">{bulk.description}</p>
      <ul className="bulk-links">
        {rows.map((r) =>
          perYear ? (
            <li key={r.key} className="bulk-year">
              <span className="bulk-link-month">
                {r.heading}
                <span className="bulk-link-detail">{r.detail}</span>
              </span>
              <span className="bulk-year-files">
                {r.files.map((f) => (
                  <a key={f.url} className="btn btn-secondary btn-sm" href={f.url} target="_blank" rel="noreferrer" title={fileName(f.url)}>
                    <Icon.Download size={14} /> {f.label}
                  </a>
                ))}
              </span>
              {r.notOut ? <Badge tone="amber">May not be out yet</Badge> : r.preliminary && <Badge tone="blue">Preliminary</Badge>}
            </li>
          ) : (
            <li key={r.key}>
              <span className="bulk-link-month">{r.heading}</span>
              <a className="link mono bulk-link-url" href={r.files[0].url} target="_blank" rel="noreferrer" title={r.files[0].url}>
                {r.files[0].label}
              </a>
              {r.notOut && <Badge tone="amber">May not be out yet</Badge>}
              <a className="btn btn-secondary btn-sm" href={r.files[0].url} target="_blank" rel="noreferrer">
                <Icon.Download size={14} /> Download
              </a>
            </li>
          )
        )}
      </ul>
      {perYear && rows.some((r) => r.preliminary) && (
        <p className="field-help">The current year’s file is renamed each time a month is added. If its link fails, the source may be a month ahead or behind; every file is on the listing page.</p>
      )}
      <div className="modal-actions">
        <a className="link bulk-listing" href={bulk.listingUrl} target="_blank" rel="noreferrer">
          Every file the source has published <Icon.External size={12} />
        </a>
        <Button size="sm" variant="secondary" icon={<Icon.Copy size={13} />} onClick={copyAll}>
          Copy {urls.length > 1 ? 'all links' : 'link'}
        </Button>
        <Button size="sm" variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
