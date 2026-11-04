'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, FileIcon, Icon, ProgressBar, useToast } from '@/components/ui';
import { fmtNumber, fmtSize, plural } from '@/lib/format';
import { canUseFolders, eachLimited, hasAccess, pickFolder, savedFolder, writeUnpacked, type Dir, type FolderCache } from '@/lib/local-folder';
import { errorText } from '@/lib/result';
import type { Run } from '@/lib/types';
import { extractor, type HeldFile } from '@/modules/service/client';
import { useApp } from '@/modules/service/store';

/** A run whose files go to the person's device instead of storage */
export const savesToDevice = (run: Run) => run.params?.options?.destination === 'device';

interface Saving {
  done: number;
  total: number;
  bytes: number;
  totalBytes: number;
}

/**
 * Files of a run saved to the device. The service holds each finished month until this page
 * downloads it into the chosen folder ({CC}/{YYYY}/{MM}/{FLOW}/{file}) and then drops it. With folder access
 * already granted that happens by itself when the page opens; otherwise one click allows it.
 */
export function DeviceFiles({ run, running }: { run: Run; running: boolean }) {
  const toast = useToast();
  const { serviceLive } = useApp();
  const [folder, setFolder] = useState<Dir | null>(null);
  const [held, setHeld] = useState<HeldFile[] | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<Saving | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const live = useRef<Saving | null>(null);
  const autoTried = useRef(false);

  const load = useCallback(
    () =>
      extractor.heldFiles(run.id).then(
        (files) => (setHeld(files), setError('')),
        (err) => setError(errorText(err))
      ),
    [run.id]
  );

  useEffect(() => {
    savedFolder().then((dir) => dir && setFolder(dir));
  }, []);
  // Months are held once the run ends (a stopped run's too)
  useEffect(() => {
    if (!running && serviceLive) load();
  }, [running, serviceLive, load]);

  // Bytes arrive per chunk; the progress redraws a few times a second instead
  const isSaving = saving !== null;
  useEffect(() => {
    if (!isSaving) return;
    const timer = setInterval(() => live.current && setSaving({ ...live.current }), 250);
    return () => clearInterval(timer);
  }, [isSaving]);

  const save = useCallback(
    async (files: HeldFile[], chosen: Dir | null, ask: boolean) => {
      const root = chosen ?? (ask ? await pickFolder() : null);
      if (!root) return;
      setFolder(root);
      if (!(await hasAccess(root, ask))) {
        if (ask) toast('err', 'No access to the folder', `Allow editing files in "${root.name}" to save the files there.`);
        return;
      }
      const p: Saving = { done: 0, total: files.length, bytes: 0, totalBytes: files.reduce((n, f) => n + f.size, 0) };
      live.current = p;
      setSaving({ ...p });
      setFailed([]);
      const controller = new AbortController();
      const cache: FolderCache = new Map();
      const saved: string[] = [];
      const errors: string[] = [];
      await eachLimited(files, 2, controller.signal, async (file) => {
        try {
          await writeUnpacked(root, file.path, () => extractor.heldFile(run.id, file.path, controller.signal), cache, controller.signal, (n) => (p.bytes += n));
          saved.push(file.path);
          p.done++;
        } catch (err) {
          errors.push(`${file.path}: ${err instanceof Error ? err.message : 'failed'}`);
        }
      });
      // Only what reached the folder is dropped from the service; the rest can be tried again
      if (saved.length) await extractor.clearHeld(run.id, saved).catch(() => {});
      live.current = null;
      setSaving(null);
      setFailed(errors);
      toast(errors.length ? 'err' : 'ok', errors.length ? `${errors.length} file(s) could not be saved` : `Saved ${plural(saved.length, 'file')} to ${root.name}`);
      await load();
    },
    [run.id, toast, load]
  );

  // Saves by itself when the folder is remembered and still allowed (no click needed then)
  useEffect(() => {
    if (autoTried.current || !held?.length || !folder || saving) return;
    autoTried.current = true;
    hasAccess(folder, false).then((ok) => {
      if (ok) save(held, folder, false);
    });
  }, [held, folder, saving, save]);

  const waiting = held ?? [];
  return (
    <section className="run-files" aria-label="Files for your device">
      <div className="run-files-head">
        <div>
          <h3 className="run-files-title">Files for your device</h3>
          <p className="panel-desc">
            {running
              ? 'Each finished extraction is held on the service until this page saves it to your folder. Keep this page open, or come back when it ends.'
              : waiting.length
                ? `${plural(waiting.length, 'file')} · ${fmtSize(waiting.reduce((n, f) => n + f.size, 0))} waiting on the service${folder ? `, to go into ${folder.name}` : ''}`
                : run.stats.files.length
                  ? `Nothing waiting: ${plural(run.stats.files.length, 'file')} went to your folder (files not saved are removed from the service after a while).`
                  : 'This extraction saved no files.'}
          </p>
        </div>
        {!running && waiting.length > 0 && !saving && (
          <div className="inline-form">
            {folder && (
              <Button size="sm" variant="ghost" onClick={() => pickFolder().then((dir) => dir && setFolder(dir))}>
                Change folder
              </Button>
            )}
            <Button size="sm" variant="primary" icon={<Icon.Download size={14} />} disabled={!canUseFolders()} onClick={() => save(waiting, folder, true)}>
              {folder ? `Save to ${folder.name}` : 'Choose folder and save'}
            </Button>
          </div>
        )}
      </div>

      {error && !running && (
        <div className="note note-warn note-tight">
          <Icon.Alert size={14} />
          <span>Could not check the files held on the service: {error}</span>
        </div>
      )}
      {saving && (
        <div className="local-copy-progress">
          <ProgressBar pct={saving.totalBytes ? Math.round((saving.bytes / saving.totalBytes) * 100) : 0} />
          <p className="field-help">
            Saving {fmtNumber(saving.done)} of {fmtNumber(saving.total)} ({fmtSize(saving.bytes)} of {fmtSize(saving.totalBytes)})…
          </p>
        </div>
      )}
      {failed.length > 0 && (
        <details className="field-help">
          <summary>{failed.length} failed. Save again to retry them.</summary>
          <ul>{failed.map((f) => <li key={f}>{f}</li>)}</ul>
        </details>
      )}

      {(waiting.length > 0 || (!running && run.stats.files.length > 0)) && (
        <ul className="file-list">
          {(waiting.length ? waiting.map((f) => f.path) : [...run.stats.files].sort()).map((path) => {
            const file = waiting.find((f) => f.path === path);
            const name = path.split('/').pop() ?? path;
            return (
              <li key={path} className="file-row">
                <FileIcon name={name} />
                <span className="file-row-text" title={path}>
                  <span className="file-row-name">{name}</span>
                  <span className="file-row-meta">{file ? `${fmtSize(file.size)} · waiting` : `In your folder as ${path}`}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
