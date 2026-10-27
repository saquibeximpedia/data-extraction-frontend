'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isUploadable, UPLOAD_ACCEPT } from '@/lib/files';
import { fmtMonth, fmtSize, hostOf, plural } from '@/lib/format';
import { dueMonths, fileUrlFor, latestPublished, monthState } from '@/lib/months';
import { AppError, errorText, unwrap } from '@/lib/result';
import { supabase } from '@/lib/supabase/browser';
import type { Country } from '@/lib/types';
import { fetchFromSource, uploadTarget } from '@/modules/files/actions';
import { useSetMonths } from './month-actions';
import { Button, Icon, MonthRangePicker, useToast } from './ui';

export const DROPZONE_HINT = (
  <span className="dropzone-text">
    <b>Drop files here</b> or click to choose · .xlsx, .xls, .csv, .zip
  </span>
);

/** Stores one file under a country and month: the server hands out a one-time upload link, the browser uploads straight to Storage */
async function upload(country: string, period: string, file: File): Promise<void> {
  const target = await unwrap(uploadTarget({ country, period, name: file.name }));
  const { error } = await supabase.storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, file, { upsert: true });
  if (error) throw new AppError(error.message, 502);
}

/** Drop or choose .xlsx, .xls, .csv and .zip files; others are skipped with a toast */
function FileDropzone({ picked, onPick }: { picked: File[]; onPick: (files: File[]) => void }) {
  const toast = useToast();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Clearing the picked files also clears the input, so the same file can be chosen again
  useEffect(() => {
    if (!picked.length && input.current) input.current.value = '';
  }, [picked]);

  const accept = (list: FileList | null) => {
    const all = [...(list ?? [])];
    const ok = all.filter((f) => isUploadable(f.name));
    if (ok.length < all.length) toast('err', `${plural(all.length - ok.length, 'file')} skipped`, 'Upload .xlsx, .xls, .csv or .zip files');
    onPick(ok);
  };

  return (
    <label
      className={`dropzone ${over ? 'over' : ''} ${picked.length ? 'has-files' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        accept(e.dataTransfer.files);
      }}
    >
      <input ref={input} type="file" multiple accept={UPLOAD_ACCEPT} className="sr-only" onChange={(e) => accept(e.target.files)} />
      <Icon.Upload size={18} />
      {picked.length ? (
        <span className="dropzone-text">
          <b>{plural(picked.length, 'file')}</b> · {picked.map((f) => `${f.name} (${fmtSize(f.size)})`).join(', ')}
        </span>
      ) : (
        DROPZONE_HINT
      )}
    </label>
  );
}

/**
 * Stores files for a country and month, optionally marking the month completed afterwards. On a
 * country's page it also offers the source: open it, or let the server fetch the month from the
 * country's direct file link. `onUploaded` runs once every picked file is in.
 */
export function CountryUpload({ country, showSource = true, onUploaded }: { country: Country; showSource?: boolean; onUploaded?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { setMonths } = useSetMonths();
  const suggested = dueMonths(country)[0] ?? latestPublished(country);
  const [period, setPeriod] = useState(suggested);
  const [picked, setPicked] = useState<File[]>([]);
  // Download-only countries are done once their files are in; extracted ones usually aren't
  const [markDone, setMarkDone] = useState(country.kind === 'manual');
  const [busy, setBusy] = useState<'upload' | 'fetch' | null>(null);
  const [progress, setProgress] = useState(0);

  const alreadyDone = monthState(country, period) === 'completed';

  async function finish(done: number, title: string) {
    if (done && markDone && !alreadyDone) await setMonths(country, [period], 'completed');
    else if (done) toast('ok', title, `${country.name} ${fmtMonth(period)}`);
    router.refresh();
  }

  async function uploadPicked() {
    setBusy('upload');
    let done = 0;
    for (const [i, file] of picked.entries()) {
      setProgress(i + 1);
      try {
        await upload(country.code, period, file);
        done++;
      } catch (err) {
        toast('err', `Could not upload ${file.name}`, errorText(err));
      }
    }
    const all = done === picked.length;
    setPicked((prev) => prev.slice(done));
    await finish(done, `Uploaded ${plural(done, 'file')}`);
    setBusy(null);
    if (all) onUploaded?.();
  }

  /** The server downloads the month's file from the direct link */
  async function fetchFile() {
    setBusy('fetch');
    try {
      const stored = await unwrap(fetchFromSource(country.code, period));
      await finish(1, `Fetched ${stored.path.split('__').pop()} (${fmtSize(stored.sizeBytes)})`);
    } catch (err) {
      toast('err', `Could not fetch ${fmtMonth(period)} from the source`, errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <fieldset className="upload-fields" disabled={busy !== null}>
      <div className="upload-grid">
        <div className="field">
          <span className="field-label">Month</span>
          <MonthRangePicker single start={period} end={period} onChange={(s) => setPeriod(s)} marked={country.completedMonths} markedLabel="Completed" />
        </div>
        <div className="field">
          <span className="field-label">Files</span>
          <FileDropzone picked={picked} onPick={setPicked} />
        </div>
      </div>

      {showSource && (country.source.url || country.source.fileUrl) && (
        <div className="upload-source">
          {country.source.url && (
            <a className="btn btn-ghost btn-sm" href={country.source.url} target="_blank" rel="noreferrer">
              Open {hostOf(country.source.url)} <Icon.External size={13} />
            </a>
          )}
          {country.source.fileUrl && period && (
            <>
              <Button size="sm" variant="secondary" icon={<Icon.Download size={14} />} loading={busy === 'fetch'} onClick={fetchFile}>
                Fetch {fmtMonth(period)} from source
              </Button>
              <span className="cell-sub mono upload-source-url" title={fileUrlFor(country.source.fileUrl, period)}>
                {fileUrlFor(country.source.fileUrl, period)}
              </span>
            </>
          )}
        </div>
      )}

      <div className="panel-foot">
        {alreadyDone ? (
          <span className="foot-summary">{fmtMonth(period)} is already completed. A file with the same name is replaced.</span>
        ) : (
          <label className="toggle">
            <input type="checkbox" className="check" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} />
            Mark {period ? fmtMonth(period) : 'the month'} completed
          </label>
        )}
        <Button variant="primary" icon={<Icon.Upload size={14} />} loading={busy === 'upload'} disabled={!period || !picked.length} onClick={uploadPicked}>
          {busy === 'upload' ? (picked.length > 1 ? `Uploading ${progress} of ${picked.length}…` : 'Uploading…') : `Upload ${picked.length > 1 ? plural(picked.length, 'file') : 'file'}`}
        </Button>
      </div>
    </fieldset>
  );
}
