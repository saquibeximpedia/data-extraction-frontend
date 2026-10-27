import JSZip from 'jszip';
import { fileUrlFor } from '@/lib/months';
import type { ExportFile } from '@/lib/types';
import { badRequest, HttpError, notFound, result } from './http';
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

// {CC}_{YYYY-MM}.csv or {CC}_{YYYY-MM}_part{N}.csv (extracted), or {CC}_{YYYY-MM}__{original name} (uploaded)
const FILE_RE = /^([A-Z]{2,3})_(\d{4}-\d{2})(?:_part(\d+))?(__.+)?\.[a-z0-9]+$/i;

const metaTable = () => admin().from('file_meta');

/** Who uploaded each file under a prefix (all files without one), by path */
async function uploadersByPath(prefix?: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    let query = metaTable().select('path, uploaded_by').order('path').range(from, from + 999);
    if (prefix) query = query.like('path', `${prefix}/%`);
    const { data } = await result(query, 'file details');
    for (const row of data as { path: string; uploaded_by: string | null }[]) if (row.uploaded_by) out.set(row.path, row.uploaded_by);
    if (data.length < 1000) return out;
  }
}

/** Records who uploaded a file (replacing what was there) */
async function saveUploader(path: string, uploadedBy: string): Promise<void> {
  await result(metaTable().upsert({ path, uploaded_by: uploadedBy, updated_at: new Date().toISOString() }), 'save file details');
}

/** Where an uploaded file for a country and month is stored */
function uploadPath(countryCode: string, period: string, originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() ?? '';
  if (!UPLOAD_TYPES[ext]) throw badRequest(`Upload .xlsx, .xls, .csv or .zip files (got .${ext || '?'})`);
  const clean = originalName.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(-120) || 'file';
  return `${countryCode}/${period.slice(0, 4)}/${countryCode}_${period}__${clean}`;
}

/** Largest file fetched from a source link (Supabase's free plan rejects uploads over 50 MB) */
const MAX_FETCH_BYTES = 50 * 1048576;

/** A %-encoded name, left as it is when it isn't valid encoding */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The downloaded file's extension: from its name, else from the type the source sent */
function extensionOf(name: string, contentType: string): string | null {
  const fromName = name.split('.').pop()?.toLowerCase() ?? '';
  if (UPLOAD_TYPES[fromName]) return fromName;
  if (/spreadsheetml/.test(contentType)) return 'xlsx';
  if (/ms-excel/.test(contentType)) return 'xls';
  if (/csv/.test(contentType)) return 'csv';
  if (/zip/.test(contentType)) return 'zip';
  return null;
}

function describe(relativePath: string): Pick<ExportFile, 'countryCode' | 'period' | 'origin' | 'part'> {
  const m = (relativePath.split('/').pop() ?? '').match(FILE_RE);
  if (!m) return { countryCode: null, period: null, origin: 'uploaded', part: null };
  return { countryCode: m[1].toUpperCase(), period: m[2], origin: m[4] ? 'uploaded' : 'extracted', part: m[3] ? Number(m[3]) : null };
}

/** Fails with a clear message when SUPABASE_BUCKET is not a bucket of this project */
export async function assertBucket(): Promise<void> {
  const { error } = await admin().storage.getBucket(BUCKET);
  if (error) throw new HttpError(502, `Storage bucket "${BUCKET}" does not exist in this Supabase project. Set SUPABASE_BUCKET to the bucket the extraction service writes to (its own SUPABASE_BUCKET), then redeploy.`);
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
    const prefix = countryCode?.toUpperCase();
    // Files still list without their uploaders, e.g. before supabase/schema.sql adds file_meta
    const uploaders = await uploadersByPath(prefix).catch((err: Error) => {
      console.error(`Files are listed without who uploaded them: ${err.message}`);
      return new Map<string, string>();
    });
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
              uploadedBy: uploaders.get(path) ?? null,
            });
          }
        }
        if (data.length < 1000) return;
      }
    };
    await walk(prefix ?? '', prefix ? 1 : 0);
    // Storage lists a missing bucket as empty: say so, or a wrong SUPABASE_BUCKET looks like "no files yet"
    if (!out.length) await assertBucket();
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
    const paths = relativePaths.map(safePath);
    const { data, error } = await bucket().remove(paths);
    if (error) fail('Delete', error);
    await result(metaTable().delete().in('path', paths), 'delete file details');
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
  async uploadTarget(countryCode: string, period: string, originalName: string, uploadedBy: string): Promise<{ path: string; token: string; bucket: string }> {
    const path = uploadPath(countryCode, period, originalName);
    const { data, error } = await bucket().createSignedUploadUrl(path, { upsert: true });
    if (error) fail('Upload', error);
    // Saved now since the browser uploads straight to Storage; a failed upload leaves a row no file matches
    await saveUploader(path, uploadedBy);
    return { path, token: data.token, bucket: BUCKET };
  },

  /**
   * Downloads a month's file from a country's direct link and stores it like an upload.
   * Sources that answer with a web page (a login or error page) are refused.
   */
  async fetchFromSource(countryCode: string, period: string, template: string, uploadedBy: string): Promise<{ path: string; url: string; sizeBytes: number }> {
    const url = fileUrlFor(template, period);
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120_000), headers: { 'User-Agent': 'Mozilla/5.0 (data-extraction file fetch)' } });
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
      throw new HttpError(502, timedOut ? `The source did not send the file within 2 minutes (${url}).` : `Could not reach the source (${url}).`, { url });
    }
    if (res.status === 404) throw new HttpError(404, `The source has no file for ${period} yet (${url} answered 404).`, { url });
    if (!res.ok) throw new HttpError(502, `The source answered HTTP ${res.status} for ${url}.`, { url });

    const contentType = res.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType.includes('text/html')) throw new HttpError(502, `The source sent a web page, not a file. Check the direct file link (${url}).`, { url });
    if (Number(res.headers.get('content-length') ?? 0) > MAX_FETCH_BYTES) throw new HttpError(413, `The file is over ${MAX_FETCH_BYTES / 1048576} MB; download it and upload it in parts.`, { url });

    const body = new Uint8Array(await res.arrayBuffer());
    if (body.byteLength > MAX_FETCH_BYTES) throw new HttpError(413, `The file is over ${MAX_FETCH_BYTES / 1048576} MB; download it and upload it in parts.`, { url });
    if (!body.byteLength) throw new HttpError(502, `The source sent an empty file (${url}).`, { url });

    // Its name: what the source calls it, else the link's last segment, else the country and month
    const disposition = res.headers.get('content-disposition') ?? '';
    const sent = safeDecode(disposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i)?.[1] ?? disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? '');
    const fromLink = safeDecode(new URL(res.url || url).pathname.split('/').pop() ?? '');
    const base = (sent || fromLink || `${countryCode}_${period}`).trim();
    const ext = extensionOf(base, contentType);
    if (!ext) throw new HttpError(502, `The source sent "${base}" (${contentType || 'unknown type'}), not an .xlsx, .xls, .csv or .zip file.`, { url });
    const name = base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;

    const path = uploadPath(countryCode, period, name);
    const { error } = await bucket().upload(path, body, { upsert: true, contentType: UPLOAD_TYPES[ext] });
    if (error) fail('Upload', error);
    await saveUploader(path, `${uploadedBy} (from source)`);
    return { path, url, sizeBytes: body.byteLength };
  },
};
