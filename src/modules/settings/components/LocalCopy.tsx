'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Field, Panel, ProgressBar, Segmented, useToast } from '@/components/ui';
import { fmtNumber, fmtSize } from '@/lib/format';
import { canUseFolders, eachLimited, hasAccess, localSize, pickFolder, saveDestination, savedDestination, savedFolder, writeFile, type Destination, type Dir, type FolderCache } from '@/lib/local-folder';
import { errorText, unwrap } from '@/lib/result';
import { fileUrls, syncList } from '@/modules/files/actions';

/** Files downloaded at once, and links asked for per call */
const PARALLEL = 3;
const BATCH = 100;

interface Progress {
  phase: 'checking' | 'copying' | 'done' | 'stopped';
  total: number;
  checked: number;
  have: number;
  toCopy: number;
  copied: number;
  bytes: number;
  totalBytes: number;
  failed: string[];
}

/**
 * This browser's data folder: where its new extractions save (the database, or the folder), and a
 * copy of every stored file into the folder. Copies every stored file into a folder on this device, laid out like storage ({CC}/{YYYY}/{file}).
 * Files already there with the same size are left alone, so files from earlier copies (or put there
 * by hand under the same names) aren't downloaded again. Needs Chrome or Edge (folder access).
 */
export function LocalCopy() {
  const toast = useToast();
  const [supported, setSupported] = useState(true);
  const [folder, setFolder] = useState<Dir | null>(null);
  const [destination, setDestination] = useState<Destination>('storage');
  const [progress, setProgress] = useState<Progress | null>(null);
  const live = useRef<Progress | null>(null);
  const stop = useRef<AbortController | null>(null);
  const running = progress?.phase === 'checking' || progress?.phase === 'copying';

  useEffect(() => {
    if (!canUseFolders()) return setSupported(false);
    setDestination(savedDestination());
    savedFolder().then((dir) => dir && setFolder(dir));
  }, []);

  /** Saving to the device needs a folder: one is asked for when none is chosen yet */
  async function chooseDestination(next: Destination) {
    if (next === 'device' && !folder && !(await pick())) return;
    saveDestination(next);
    setDestination(next);
    toast('ok', next === 'device' ? 'New extractions save to this device' : 'New extractions save to the database');
  }

  // Counts change per chunk downloaded; the panel redraws a few times a second instead
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => live.current && setProgress({ ...live.current }), 250);
    return () => clearInterval(timer);
  }, [running]);

  async function pick(): Promise<Dir | null> {
    const dir = await pickFolder();
    if (dir) setFolder(dir);
    return dir;
  }

  async function copy(chosen: Dir | null) {
    const root = chosen ?? (await pick());
    if (!root) return;
    if (!(await hasAccess(root, true))) {
      toast('err', 'No access to the folder', 'Allow editing files in the folder to copy into it.');
      return;
    }

    const controller = new AbortController();
    stop.current = controller;
    const p: Progress = { phase: 'checking', total: 0, checked: 0, have: 0, toCopy: 0, copied: 0, bytes: 0, totalBytes: 0, failed: [] };
    live.current = p;
    setProgress({ ...p });
    const finish = (phase: Progress['phase']) => {
      p.phase = phase;
      setProgress({ ...p });
    };

    try {
      const list = await unwrap(syncList());
      p.total = list.length;

      // Which files are missing here, or differ in size (re-extracted since the last copy)
      const existing: FolderCache = new Map();
      const todo: typeof list = [];
      for (const file of list) {
        if (controller.signal.aborted) return finish('stopped');
        if ((await localSize(root, file.path, existing)) === file.size) p.have++;
        else todo.push(file);
        p.checked++;
      }
      p.toCopy = todo.length;
      p.totalBytes = todo.reduce((n, f) => n + f.size, 0);
      p.phase = 'copying';

      const made: FolderCache = new Map();
      for (let i = 0; i < todo.length && !controller.signal.aborted; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        const urls = await unwrap(fileUrls(batch.map((f) => f.path)));
        await eachLimited(batch, PARALLEL, controller.signal, async (file) => {
          try {
            if (!urls[file.path]) throw new Error('no longer in storage');
            await writeFile(root, file.path, () => fetch(urls[file.path], { signal: controller.signal }), made, controller.signal, (n) => (p.bytes += n));
            p.copied++;
          } catch (err) {
            if (!controller.signal.aborted) p.failed.push(`${file.path}: ${err instanceof Error ? err.message : 'failed'}`);
          }
        });
      }
      finish(controller.signal.aborted ? 'stopped' : 'done');
      if (!controller.signal.aborted) {
        toast(p.failed.length ? 'err' : 'ok', p.failed.length ? `${p.failed.length} file(s) could not be copied` : `Folder is up to date: ${fmtNumber(p.copied)} copied, ${fmtNumber(p.have)} already there`);
      }
    } catch (err) {
      finish('stopped');
      toast('err', 'Could not copy the files', errorText(err));
    } finally {
      stop.current = null;
    }
  }

  const desc = 'Where extractions started in this browser save their files, and a copy of every stored file into a folder here, in country and year folders.';
  if (!supported) {
    return (
      <Panel i={3} title="Files on this device" desc={desc}>
        <p className="foot-summary">Extractions save to the database. Saving to or copying into a folder needs Chrome or Edge on a computer.</p>
      </Panel>
    );
  }

  const pct = !progress ? 0 : progress.phase === 'checking' ? (progress.total ? (progress.checked / progress.total) * 100 : 0) : progress.totalBytes ? (progress.bytes / progress.totalBytes) * 100 : 100;
  return (
    <Panel i={3} title="Files on this device" desc={desc}>
      <Field label="New extractions save to">
        <Segmented<Destination>
          label="New extractions save to"
          value={destination}
          onChange={chooseDestination}
          options={[
            { value: 'storage', label: 'Database' },
            { value: 'device', label: 'My device' },
          ]}
        />
        <p className="field-help">
          {destination === 'device'
            ? 'Into the folder below, not stored online. The service holds each finished extraction until its page saves it here, so open the extraction after it ends. For this browser only.'
            : 'Stored online, on the Files page for everyone. For this browser only.'}
        </p>
      </Field>
      <p className="foot-summary local-copy-folder">
        {folder ? <>Folder: <strong>{folder.name}</strong></> : 'No folder chosen yet.'} Laid out as country / year / file, e.g. THA/2026/THA_2026-09.zip.
      </p>
      {progress && (
        <div className="local-copy-progress">
          <ProgressBar pct={Math.round(pct)} />
          <p className="field-help">
            {progress.phase === 'checking'
              ? `Checking ${fmtNumber(progress.checked)} of ${fmtNumber(progress.total)} files…`
              : `${fmtNumber(progress.copied)} of ${fmtNumber(progress.toCopy)} copied (${fmtSize(progress.bytes)} of ${fmtSize(progress.totalBytes)}) · ${fmtNumber(progress.have)} already there${progress.phase === 'stopped' ? ' · stopped' : ''}`}
          </p>
          {progress.failed.length > 0 && (
            <details className="field-help">
              <summary>{progress.failed.length} failed. Copy again to retry them.</summary>
              <ul>{progress.failed.slice(0, 50).map((f) => <li key={f}>{f}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      <div className="panel-foot">
        <Button size="sm" variant="ghost" disabled={running} onClick={pick}>
          {folder ? 'Change folder' : 'Choose folder'}
        </Button>
        {running ? (
          <Button size="sm" variant="secondary" onClick={() => stop.current?.abort()}>
            Stop
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={() => copy(folder)}>
            {folder ? 'Copy new and changed files' : 'Choose folder and copy'}
          </Button>
        )}
      </div>
    </Panel>
  );
}
