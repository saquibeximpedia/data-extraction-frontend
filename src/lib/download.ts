'use client';

import { useState } from 'react';
import { fileUrl } from '@/modules/files/actions';
import { useToast } from '@/components/ui';
import { AppError, errorText, unwrap } from './result';

/** Opens a URL as a download without leaving the page */
export function saveFrom(url: string, name?: string): void {
  const link = Object.assign(document.createElement('a'), { href: url, rel: 'noopener', ...(name && { download: name }) });
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** POSTs JSON and saves the file the server answers with (e.g. a zip), under the name it gives */
export async function saveResponse(url: string, body: unknown, fallbackName: string): Promise<void> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new AppError(data.error || `Request failed (HTTP ${res.status})`, res.status, data);
  }
  const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const blobUrl = URL.createObjectURL(await res.blob());
  saveFrom(blobUrl, name);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}

/**
 * Has the browser save a POSTed zip as a normal download (streamed to disk, with its progress bar)
 * instead of holding it in the page: the files are checked first, so problems still show here.
 */
async function saveZip(url: string, paths: string[]): Promise<void> {
  const check = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paths, check: true }) });
  if (!check.ok) {
    const data = await check.json().catch(() => ({}));
    throw new AppError(data.error || `Request failed (HTTP ${check.status})`, check.status, data);
  }
  // The answer is an attachment, so the hidden frame never shows anything
  const frame = Object.assign(document.createElement('iframe'), { name: `zip-${Date.now()}`, hidden: true });
  const form = Object.assign(document.createElement('form'), { method: 'POST', action: url, target: frame.name });
  form.appendChild(Object.assign(document.createElement('input'), { type: 'hidden', name: 'paths', value: JSON.stringify(paths) }));
  document.body.append(frame, form);
  form.submit();
  form.remove();
  // Long enough for the download to start; the frame then has nothing left to do
  setTimeout(() => frame.remove(), 60_000);
}

/** Downloads stored files: one through a short-lived signed link, several as one zip. `busy` is the key being downloaded. */
export function useDownload() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function download(paths: string[], key = paths.join('|')) {
    setBusy(key);
    try {
      if (paths.length === 1) saveFrom(await unwrap(fileUrl(paths[0])));
      else await saveZip('/api/files/zip', paths);
    } catch (err) {
      toast('err', 'Could not download', errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return { busy, download };
}
