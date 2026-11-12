'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Icon, Modal, ProgressBar, useToast } from '@/components/ui';
import { fmtNumber, plural } from '@/lib/format';
import { refreshData } from '@/lib/refresh';
import { errorText } from '@/lib/result';
import { runTask, useTask } from '@/lib/tasks';
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

/** A merge followed in the background: its latest state, and why it couldn't be checked */
interface Following {
  job: MergeJob;
  error: string;
}

/** Checks that fail in a row before the merge is no longer followed */
const MAX_MISSES = 3;

/**
 * Merges the selected extracted files into one dataset on the extraction service, saved under
 * merged/{name}/ (in parts of at most 9 lakh rows when big). Every column of every file is kept,
 * with the country, flow and month in front. Shows the merge's progress until it ends; closing
 * (or leaving the page) leaves it running, and a toast says when it is done.
 */
export function MergeModal({ files, onClose, onDone }: { files: ExportFile[] | null; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const followed = useTask<Following>(`merge:${jobId}`);
  const job = jobId ? (followed?.progress.job ?? null) : null;
  // The merge this dialog shows, if any: it says how that one ended, so no toast is needed then
  const shown = useRef<string | null>(null);
  shown.current = files ? jobId : null;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => () => void (shown.current = null), []);

  const extracted = files?.filter((f) => f.origin === 'extracted') ?? [];
  const leftOut = (files?.length ?? 0) - extracted.length;
  const countries = [...new Set(extracted.map((f) => f.countryCode).filter(Boolean))];

  // Each opening starts from a blank form
  useEffect(() => {
    if (!files) return;
    setName(suggestName(files.filter((f) => f.origin === 'extracted')));
    setError('');
    setJobId(null);
  }, [files]);

  /** Follows a merge until it ends, wherever the person goes meanwhile */
  function follow(first: MergeJob) {
    runTask<Following>(`merge:${first.id}`, { job: first, error: '' }, async (f, signal) => {
      let misses = 0;
      while (f.job.status === 'RUNNING' && !signal.aborted && misses < MAX_MISSES) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        try {
          f.job = await extractor.mergeStatus(f.job.id);
          f.error = '';
          misses = 0;
        } catch (err) {
          f.error = errorText(err);
          misses++;
        }
      }
      const { job: end } = f;
      if (end.status === 'COMPLETED') {
        // The service wrote the merged files, past the server's cached list
        void refreshData().then(() => router.refresh());
        if (shown.current === end.id) done.current();
        else toast('ok', `Merged ${end.name}`, `${fmtNumber(end.rowsWritten)} rows in merged/${end.name}/`, { label: 'Open', onClick: () => router.push('/files?view=merged') });
      } else if (end.status === 'FAILED' && shown.current !== end.id) {
        toast('err', `Merge ${end.name} failed`, end.error ?? 'Nothing was saved.');
      }
    });
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!NAME.test(name)) return;
    setStarting(true);
    setError('');
    try {
      const started = await extractor.merge(extracted.map((f) => f.relativePath), name);
      setJobId(started.id);
      follow(started);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setStarting(false);
    }
  }

  const running = job?.status === 'RUNNING';
  function close() {
    if (running) toast('ok', 'The merge carries on', `It runs on the extraction service; you'll be told here when ${job!.name} is done.`);
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
          {job.status === 'COMPLETED' && job.onServer.length > 0 && (
            <p className="field-help">
              {job.onServer.length === job.outputs.length ? (job.outputs.length > 1 ? 'They are' : 'It is') : `${plural(job.onServer.length, 'part')} ${job.onServer.length > 1 ? 'are' : 'is'}`} kept on the server, not in the cloud: {job.onServer[0].reason}. Find {job.onServer.length > 1 ? 'them' : 'it'} under Merged, marked On server.
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
          {(error || followed?.progress.error) && <p className="field-error">{error || followed?.progress.error}</p>}
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
