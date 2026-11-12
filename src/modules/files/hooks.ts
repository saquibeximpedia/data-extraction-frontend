'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui';
import { plural } from '@/lib/format';
import { canUseFolders, eachLimited, hasAccess, pickFolder, savedFolder, writeUnpacked, type FolderCache } from '@/lib/local-folder';
import { errorText, unwrap } from '@/lib/result';
import { runTask, useTask } from '@/lib/tasks';
import { extractor } from '@/modules/service/client';
import { fileUrls } from './actions';

/** Files fetched and written at once */
const PARALLEL = 3;

const SAVE_TASK = 'save-to-folder';

interface SaveProgress {
  /** What is being saved, e.g. one file's path or "selection" */
  key: string;
  done: number;
  total: number;
}

/**
 * Saves stored files into this browser's data folder (the one on Settings, asked for when none is
 * chosen), laid out as in storage: {CC}/{YYYY}/{MM}/{FLOW}/{file}, with zips unpacked there. A file already
 * there is replaced. `busy` is the key being saved; `progress` counts the stored files done. The
 * saving carries on (and its progress is kept) when the page is left. Needs Chrome or Edge.
 */
export function useSaveToFolder(isOnServer: (path: string) => boolean = () => false) {
  const toast = useToast();
  const [supported, setSupported] = useState(false);
  const task = useTask<SaveProgress>(SAVE_TASK);
  const running = task?.running ? task.progress : null;

  // Known only in the browser, so it is checked after the page is shown
  useEffect(() => setSupported(canUseFolders()), []);

  async function save(paths: string[], key = paths.join('|')) {
    if (running) return toast('err', 'Still saving to the folder', `${running.done} of ${running.total} done; try again once it ends.`);
    const root = (await savedFolder()) ?? (await pickFolder());
    if (!root) return;
    if (!(await hasAccess(root, true))) {
      toast('err', 'No access to the folder', `Allow editing files in "${root.name}" to save the files there.`);
      return;
    }

    await runTask<SaveProgress>(SAVE_TASK, { key, done: 0, total: paths.length }, async (progress, signal) => {
      const cache: FolderCache = new Map();
      const failed: string[] = [];
      let written = 0;
      try {
        // Files kept on the extraction service come from it; the rest from storage
        const onServer = paths.filter(isOnServer);
        const cloud = paths.filter((p) => !isOnServer(p));
        const urls = { ...(cloud.length ? await unwrap(fileUrls(cloud)) : {}), ...(onServer.length ? await extractor.serverFileLinks(onServer) : {}) };
        await eachLimited(paths, PARALLEL, signal, async (path) => {
          try {
            if (!urls[path]) throw new Error('no longer in storage');
            written += await writeUnpacked(root, path, () => fetch(urls[path], { signal }), cache, signal, () => {});
          } catch (err) {
            failed.push(`${path}: ${err instanceof Error ? err.message : 'failed'}`);
          }
          progress.done++;
        });
        if (failed.length) toast('err', `${plural(failed.length, 'file')} could not be saved to ${root.name}`, failed.slice(0, 3).join('\n'));
        else toast('ok', `Saved ${plural(written, 'file')} to ${root.name}`, 'In the same folders as in storage (country, year, month, import/export), with zips unpacked.');
      } catch (err) {
        toast('err', 'Could not save to the folder', errorText(err));
      }
    });
  }

  return { supported, busy: running?.key ?? null, progress: running ?? { done: 0, total: 0 }, save };
}
