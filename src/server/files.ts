import JSZip from 'jszip';
import type { ExportFile } from '@/lib/types';
import { badRequest, HttpError, notFound } from './http';
import { admin, BUCKET } from './supabase';

const bucket = () => admin().storage.from(BUCKET);

/** Paths are "{CC}/{YYYY}/{file}": no leading slash, no "..", no empty segments */
export function safePath(relativePath: string): string {
  const p = relativePath.replace(/\\/g, '/').trim();
  if (!p || p.startsWith('/') || p.split('/').some((seg) => !seg || seg === '.' || seg === '..')) {
    throw badRequest(`Invalid file path: ${relativePath}`);
  }
  return p;
}

function fail(action: string, error: { message: string }): never {
  if (/not.?found/i.test(error.message)) throw notFound(`${action}: file not found`);
  throw new HttpError(502, `${action}: ${error.message}`);
}

// {CC}_{YYYY-MM}.csv (extracted) or {CC}_{YYYY-MM}__{original name} (uploaded)
const FILE_RE = /^([A-Z]{2,3})_(\d{4}-\d{2})(__.+)?\.[a-z0-9]+$/i;

function describe(relativePath: string): Pick<ExportFile, 'countryCode' | 'period' | 'origin'> {
  const m = (relativePath.split('/').pop() ?? '').match(FILE_RE);
  if (!m) return { countryCode: null, period: null, origin: 'uploaded' };
  return { countryCode: m[1].toUpperCase(), period: m[2], origin: m[3] ? 'uploaded' : 'extracted' };
}

export const UPLOAD_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  zip: 'application/zip',
};

/**
 * Files in the private bucket, one folder per country and year:
 *   {CC}/{YYYY}/{CC}_{YYYY-MM}.csv            written by the extraction service
 *   {CC}/{YYYY}/{CC}_{YYYY-MM}__{name}.xlsx   uploaded by users for download-only countries
 * The browser never gets bucket access: it downloads through short-lived signed links and
 * uploads through one-time signed upload links handed out here.
 */
export const files = {
  /** Every file, newest first (folders are walked: country → year → files) */
  async list(countryCode?: string): Promise<ExportFile[]> {
    const out: ExportFile[] = [];
    const walk = async (prefix: string, depth: number): Promise<void> => {
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await bucket().list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) fail('List', error);
        for (const entry of data) {
          const path = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.id === null) {
            if (depth < 3) await walk(path, depth + 1);
          } else if (!entry.name.startsWith('.')) {
            out.push({
              fileName: entry.name,
              relativePath: path,
              sizeBytes: Number(entry.metadata?.size ?? 0),
              modifiedAt: entry.updated_at ?? entry.created_at ?? '',
              ...describe(path),
            });
          }
        }
        if (data.length < 1000) return;
      }
    };
    await walk(countryCode ? countryCode.toUpperCase() : '', countryCode ? 1 : 0);
    return out.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  },

  /** A link that downloads the file for the next five minutes */
  async signedUrl(relativePath: string): Promise<string> {
    const path = safePath(relativePath);
    const { data, error } = await bucket().createSignedUrl(path, 300, { download: path.split('/').pop() });
    if (error) fail('Download', error);
    return data.signedUrl;
  },

  async remove(relativePaths: string[]): Promise<string[]> {
    const { data, error } = await bucket().remove(relativePaths.map(safePath));
    if (error) fail('Delete', error);
    return data.map((f) => f.name);
  },

  /** The files as one zip (kept under their folders) */
  async zip(relativePaths: string[]): Promise<Uint8Array> {
    const zip = new JSZip();
    for (const relativePath of relativePaths) {
      const { data, error } = await bucket().download(safePath(relativePath));
      if (error) fail(`Download ${relativePath}`, error);
      zip.file(relativePath, new Uint8Array(await data.arrayBuffer()));
    }
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  },

  /** Where an uploaded file goes, and a one-time link the browser uploads it to (it may replace a file with the same name) */
  async uploadTarget(countryCode: string, period: string, originalName: string): Promise<{ path: string; token: string; bucket: string }> {
    const ext = originalName.split('.').pop()?.toLowerCase() ?? '';
    if (!UPLOAD_TYPES[ext]) throw badRequest(`Upload .xlsx, .xls, .csv or .zip files (got .${ext || '?'})`);
    const clean = originalName.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(-120) || 'file';
    const path = `${countryCode}/${period.slice(0, 4)}/${countryCode}_${period}__${clean}`;
    const { data, error } = await bucket().createSignedUploadUrl(path, { upsert: true });
    if (error) fail('Upload', error);
    return { path, token: data.token, bucket: BUCKET };
  },
};
