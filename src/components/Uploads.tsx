'use client';

import { useEffect, useRef, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { fmtMonth, fmtSize, hostOf, plural } from '@/lib/format';
import { useCountryStatus, useSetMonths } from '@/lib/hooks';
import { fileUrlFor, latestPublished, monthState } from '@/lib/months';
import { useApp } from '@/lib/store';
import type { Country } from '@/lib/types';
import { Button, Field, Icon, Modal, MonthRangePicker, Select, useToast } from './ui';

const ACCEPTED = /\.(xlsx|xls|csv|zip)$/i;

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
    const ok = all.filter((f) => ACCEPTED.test(f.name));
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
      <input ref={input} type="file" multiple accept=".xlsx,.xls,.csv,.zip" className="sr-only" onChange={(e) => accept(e.target.files)} />
      <Icon.Upload size={18} />
      {picked.length ? (
        <span className="dropzone-text">
          <b>{plural(picked.length, 'file')}</b> · {picked.map((f) => `${f.name} (${fmtSize(f.size)})`).join(', ')}
        </span>
      ) : (
        <span className="dropzone-text">
          <b>Drop files here</b> or click to choose · .xlsx, .xls, .csv, .zip
        </span>
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
  const { refreshFiles } = useApp();
  const toast = useToast();
  const { due } = useCountryStatus(country);
  const { setMonths } = useSetMonths();
  const suggested = due[0] ?? latestPublished(country);
  const [period, setPeriod] = useState(suggested);
  const [picked, setPicked] = useState<File[]>([]);
  // Download-only countries are done once their files are in; extracted ones usually aren't
  const [markDone, setMarkDone] = useState(country.kind === 'manual');
  const [busy, setBusy] = useState<'upload' | 'fetch' | null>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setPeriod(suggested);
    setPicked([]);
    setMarkDone(country.kind === 'manual');
  }, [country.code]);

  const alreadyDone = monthState(country, period) === 'completed';

  async function finish(done: number, title: string) {
    refreshFiles();
    if (done && markDone && !alreadyDone) await setMonths(country, [period], 'completed');
    else if (done) toast('ok', title, `${country.name} ${fmtMonth(period)}`);
  }

  async function upload() {
    setBusy('upload');
    let done = 0;
    for (const [i, file] of picked.entries()) {
      setProgress(i + 1);
      try {
        await api.upload(country.code, period, file);
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
      const stored = await api.fetchFromSource(country.code, period);
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
        <Button variant="primary" icon={<Icon.Upload size={14} />} loading={busy === 'upload'} disabled={!period || !picked.length} onClick={upload}>
          {busy === 'upload' ? (picked.length > 1 ? `Uploading ${progress} of ${picked.length}…` : 'Uploading…') : `Upload ${picked.length > 1 ? plural(picked.length, 'file') : 'file'}`}
        </Button>
      </div>
    </fieldset>
  );
}

/** Upload popup: pick the country, then its month and files; closes once they are in */
export function UploadModal({ open, onClose, initialCode }: { open: boolean; onClose: () => void; initialCode?: string }) {
  const { countries } = useApp();
  const [code, setCode] = useState('');
  useEffect(() => {
    if (open) setCode(initialCode?.toUpperCase() ?? '');
  }, [open, initialCode]);

  const picked = countries?.find((c) => c.code === code);
  return (
    <Modal open={open} onClose={onClose} title="Upload files" icon={<Icon.Upload size={17} />} wide>
      <div className="upload-form">
        <Field label="Country" htmlFor="up-country">
          <Select
            id="up-country"
            value={picked?.code}
            placeholder={countries ? 'Choose a country' : 'Loading…'}
            options={(countries ?? []).map((c) => ({ value: c.code, label: c.name, meta: c.kind === 'manual' ? `${c.code} · download-only` : c.code }))}
            onChange={setCode}
          />
        </Field>
        {picked ? <CountryUpload key={picked.code} country={picked} showSource={false} onUploaded={onClose} /> : <UploadPlaceholder />}
      </div>
    </Modal>
  );
}

/** The month and file fields before a country is chosen: the same layout, disabled, so nothing moves once one is */
function UploadPlaceholder() {
  return (
    <fieldset className="upload-fields" disabled>
      <div className="upload-grid">
        <div className="field">
          <span className="field-label">Month</span>
          <button type="button" className="control select-trigger" disabled>
            <Icon.Calendar size={15} />
            <span className="select-value placeholder">Choose a country first</span>
          </button>
        </div>
        <div className="field">
          <span className="field-label">Files</span>
          <div className="dropzone is-disabled">
            <Icon.Upload size={18} />
            <span className="dropzone-text">
              <b>Drop files here</b> or click to choose · .xlsx, .xls, .csv, .zip
            </span>
          </div>
        </div>
      </div>
      <div className="panel-foot">
        <label className="toggle">
          <input type="checkbox" className="check" disabled /> Mark the month completed
        </label>
        <Button variant="primary" icon={<Icon.Upload size={14} />} disabled>
          Upload file
        </Button>
      </div>
    </fieldset>
  );
}
