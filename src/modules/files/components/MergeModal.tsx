'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Icon, Modal, ProgressBar, useToast } from '@/components/ui';
import { fmtNumber, plural } from '@/lib/format';
import { errorText } from '@/lib/result';
import type { ExportFile, MergeJob } from '@/lib/types';
import { extractor } from '@/modules/service/client';

const POLL_MS = 2000;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

/** A name from what is merged, e.g. "TUR_IND_2025-2026" */
function suggestName(files: ExportFile[]): string {
  const codes = [...new Set(files.map((f) => f.countryCode).filter(Boolean))];
  const years = [...new Set(files.map((f) => f.period?.slice(0, 4)).filter(Boolean))].sort();
  const span = years.length ? (years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : years[0]) : '';
  return [codes.slice(0, 4).join('_') || 'merge', span].filter(Boolean).join('_').slice(0, 80);
}

/**
 * Merges the selected extracted files into one dataset on the extraction service, saved under
 * merged/{name}/ (in parts of at most 9 lakh rows when big). Every column of every file is kept,
 * with the country, flow and month in front. Shows the merge's progress until it ends; closing
 * leaves it running on the service.
 */
export function MergeModal({ files, onClose, onDone }: { files: ExportFile[] | null; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState<MergeJob | null>(null);

  const extracted = files?.filter((f) => f.origin === 'extracted') ?? [];
  const leftOut = (files?.length ?? 0) - extracted.length;
  const countries = [...new Set(extracted.map((f) => f.countryCode).filter(Boolean))];

  // Each opening starts from a blank form
  useEffect(() => {
    if (!files) return;
    setName(suggestName(files.filter((f) => f.origin === 'extracted')));
    setError('');
    setJob(null);
  }, [files]);

  // Follows a running merge until it ends
  const running = job?.status === 'RUNNING';
  useEffect(() => {
    if (!job || job.status !== 'RUNNING') return;
    const timer = setTimeout(async () => {
      try {
        const next = await extractor.mergeStatus(job.id);
        setJob(next);
        if (next.status === 'COMPLETED') {
          router.refresh();
          onDone();
        }
      } catch (err) {
        setError(errorText(err));
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [job, router, onDone]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!NAME.test(name)) return;
    setStarting(true);
    setError('');
    try {
      setJob(await extractor.merge(extracted.map((f) => f.relativePath), name));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setStarting(false);
    }
  }

  function close() {
    if (running) toast('ok', 'The merge carries on', `It runs on the extraction service; ${job!.name} appears under Merged when it is done.`);
    onClose();
  }

  const pct = job?.rowsTotal ? Math.round((job.rowsWritten / job.rowsTotal) * 100) : 0;

  return (
    <Modal open={Boolean(files)} onClose={close} busy={starting} title={job ? `Merge ${job.name}` : `Merge ${plural(extracted.length, 'file')}`} icon={<Icon.Merge size={18} />}>
      {job ? (
        <div className="share-form">
          {job.status === 'RUNNING' && (
            <>
              <p className="modal-text">
                {job.step}
                {job.rowsTotal ? ` · ${fmtNumber(job.rowsWritten)} of ${fmtNumber(job.rowsTotal)} rows` : ''}
              </p>
              <ProgressBar pct={pct} />
              <p className="field-help">You can close this: the merge carries on on the extraction service.</p>
            </>
          )}
          {job.status === 'COMPLETED' && (
            <p className="modal-text">
              <b>{fmtNumber(job.rowsWritten)} rows</b> from {plural(job.sources.length, 'file')} saved as {job.outputs.length > 1 ? `${job.outputs.length} parts of up to 9 lakh rows` : 'one file'} in <span className="mono">merged/{job.name}/</span>. Every row was counted before and after writing.
            </p>
          )}
          {job.status === 'FAILED' && (
            <div className="note note-error note-tight" role="alert">
              <Icon.Alert />
              <span>
                <b>The merge failed; nothing was saved.</b> {job.error}
              </span>
            </div>
          )}
          {error && <p className="field-error">{error}</p>}
          <div className="modal-actions">
            {job.status === 'COMPLETED' ? (
              <Button
                variant="primary"
                size="sm"
                icon={<Icon.Folder size={14} />}
                onClick={() => {
                  onClose();
                  router.push('/files?view=merged');
                }}
              >
                Open merged files
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={close}>
                Close
              </Button>
            )}
          </div>
        </div>
      ) : (
        <form className="share-form" onSubmit={start}>
          <p className="modal-text">
            {plural(extracted.length, 'extracted file')}
            {countries.length ? ` from ${countries.join(', ')}` : ''} become one dataset: every column of every file, with the country, flow and month in front. Big merges are saved in parts of up to 9 lakh rows, so each opens in Excel.
          </p>
          {leftOut > 0 && <p className="field-help">{plural(leftOut, 'uploaded or merged file')} in the selection {leftOut === 1 ? 'is' : 'are'} left out.</p>}
          <Field label="Name" htmlFor="merge-name" aside={<span className="field-aside">Letters, digits, _ and -</span>}>
            <input id="merge-name" className="control mono" value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value.replace(/\s+/g, '_'))} />
          </Field>
          {name && !NAME.test(name) && <p className="field-error">Use letters, digits, _ and -, starting with a letter or digit.</p>}
          {error && <p className="field-error">{error}</p>}
          <div className="modal-actions">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={starting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" icon={<Icon.Merge size={14} />} loading={starting} disabled={!extracted.length || !NAME.test(name)}>
              Merge
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
