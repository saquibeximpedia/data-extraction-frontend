'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Icon, Modal, Spinner, useToast } from '@/components/ui';
import { fmtMonth, plural } from '@/lib/format';
import { errorText } from '@/lib/result';
import type { SourceMonth, TradeFlow } from '@/lib/types';
import { extractor } from '@/modules/service/client';

const FLOW_LABEL: Record<TradeFlow, string> = { IMPORT: 'Imports', EXPORT: 'Exports' };
/** Gap between files of "Download all", so the browser takes each one */
const DOWNLOAD_GAP_MS = 800;

/**
 * Starts a download without leaving the page: a hidden frame loads the file, and the source's
 * own server sends it with its name. Removed after a minute, when the download is under way.
 */
function startDownload(url: string) {
  const frame = document.createElement('iframe');
  frame.style.display = 'none';
  frame.src = url;
  document.body.appendChild(frame);
  setTimeout(() => frame.remove(), 60_000);
}

/**
 * The chosen months' files at the source, for source-files countries: the service only looks up
 * the links, and each file downloads straight from the source to this device. Nothing runs on
 * the service, nothing is stored, and the months' status is left as it is.
 */
export function SourceFilesModal({
  open,
  onClose,
  countryCode,
  start,
  end,
  flow,
  description,
}: {
  open: boolean;
  onClose: () => void;
  countryCode: string;
  start: string;
  end: string;
  flow: 'ALL' | TradeFlow;
  description: string;
}) {
  const toast = useToast();
  const [months, setMonths] = useState<SourceMonth[] | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setMonths(null);
    setError('');
    extractor.sourceFiles(countryCode, start, end, flow).then(
      (m) => live && setMonths(m),
      (err) => live && setError(errorText(err))
    );
    return () => {
      live = false;
    };
  }, [open, countryCode, start, end, flow]);

  const files = months?.flatMap((m) => m.files) ?? [];
  const missing = months?.filter((m) => !m.files.length) ?? [];

  async function downloadAll() {
    setDownloading(true);
    for (const [i, f] of files.entries()) {
      if (i) await new Promise((r) => setTimeout(r, DOWNLOAD_GAP_MS));
      startDownload(f.url);
    }
    setDownloading(false);
    toast('ok', `${plural(files.length, 'download')} started. If your browser asks, allow this site to download several files.`);
  }

  const copyAll = () =>
    navigator.clipboard?.writeText(files.map((f) => f.url).join('\n')).then(
      () => toast('ok', `${plural(files.length, 'link')} copied`),
      () => toast('err', 'Could not copy the links')
    );

  return (
    <Modal open={open} onClose={onClose} title={`Source files · ${months ? plural(files.length, 'file') : 'looking up'}`} icon={<Icon.Download size={16} />} wide>
      <p className="modal-body">{description} Each file downloads straight from the source to this device; nothing is saved on the server or in the database.</p>
      {error ? (
        <div className="note note-error" role="alert">
          <Icon.Alert /> <span>{error}</span>
        </div>
      ) : !months ? (
        <p className="field-help">
          <Spinner /> Looking up the files at the source…
        </p>
      ) : (
        <ul className="bulk-links">
          {months.map((m) => (
            <li key={`${m.period}_${m.flow}`} className="bulk-year">
              <span className="bulk-link-month">
                {fmtMonth(m.period)}
                <span className="bulk-link-detail">{FLOW_LABEL[m.flow]}</span>
              </span>
              <span className="bulk-year-files">
                {m.files.map((f) => (
                  <a key={f.url} className="btn btn-secondary btn-sm" href={f.url} target="_blank" rel="noreferrer" title={f.url}>
                    <Icon.Download size={14} /> {f.name}
                  </a>
                ))}
              </span>
              {!m.files.length && <Badge tone="amber">Not published yet</Badge>}
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 && <p className="field-help">{plural(missing.length, 'month')} not out at the source yet; try again once it publishes them.</p>}
      <div className="modal-actions">
        <Button size="sm" variant="secondary" icon={<Icon.Copy size={13} />} disabled={!files.length} onClick={copyAll}>
          Copy {files.length > 1 ? 'all links' : 'link'}
        </Button>
        <Button size="sm" variant="primary" icon={<Icon.Download size={14} />} disabled={!files.length} loading={downloading} onClick={downloadAll}>
          Download {files.length > 1 ? `all ${files.length}` : 'file'}
        </Button>
      </div>
    </Modal>
  );
}
