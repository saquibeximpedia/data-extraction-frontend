'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui';
import { plural } from '@/lib/format';
import { canUseFolders, eachLimited, hasAccess, pickFolder, savedFolder, writeUnpacked, type FolderCache } from '@/lib/local-folder';
import { errorText, unwrap } from '@/lib/result';
import { fileUrls } from './actions';

/** Files fetched and written at once */
const PARALLEL = 3;

/**
 * Saves stored files into this browser's data folder (the one on Settings, asked for when none is
 * chosen), laid out as in storage: {CC}/{YYYY}/{file}, with zips unpacked there. A file already
 * there is replaced. `busy` is the key being saved; `progress` counts the stored files done.
 * Needs Chrome or Edge.
 */
export function useSaveToFolder() {
  const toast = useToast();
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // Known only in the browser, so it is checked after the page is shown
  useEffect(() => setSupported(canUseFolders()), []);

  async function save(paths: string[], key = paths.join('|')) {
    const root = (await savedFolder()) ?? (await pickFolder());
    if (!root) return;
    if (!(await hasAccess(root, true))) {
      toast('err', 'No access to the folder', `Allow editing files in "${root.name}" to save the files there.`);
      return;
    }

    setBusy(key);
    setProgress({ done: 0, total: paths.length });
    const controller = new AbortController();
    const cache: FolderCache = new Map();
    const failed: string[] = [];
    let written = 0;
    try {
      const urls = await unwrap(fileUrls(paths));
      await eachLimited(paths, PARALLEL, controller.signal, async (path) => {
        try {
          if (!urls[path]) throw new Error('no longer in storage');
          written += await writeUnpacked(root, path, () => fetch(urls[path], { signal: controller.signal }), cache, controller.signal, () => {});
        } catch (err) {
          failed.push(`${path}: ${err instanceof Error ? err.message : 'failed'}`);
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      });
      if (failed.length) toast('err', `${plural(failed.length, 'file')} could not be saved to ${root.name}`, failed.slice(0, 3).join('\n'));
      else toast('ok', `Saved ${plural(written, 'file')} to ${root.name}`, 'In country and year folders, as in storage, with zips unpacked.');
    } catch (err) {
      toast('err', 'Could not save to the folder', errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return { supported, busy, progress, save };
}
