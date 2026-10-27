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

/** Downloads stored files: one through a short-lived signed link, several as one zip. `busy` is the key being downloaded. */
export function useDownload() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function download(paths: string[], key = paths.join('|')) {
    setBusy(key);
    try {
      if (paths.length === 1) saveFrom(await unwrap(fileUrl(paths[0])));
      else await saveResponse('/api/files/zip', { paths }, 'trade-data.zip');
    } catch (err) {
      toast('err', 'Could not download', errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return { busy, download };
}
