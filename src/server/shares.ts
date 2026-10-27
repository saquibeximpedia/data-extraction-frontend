import crypto from 'crypto';
import { promisify } from 'util';
import type { PublicShare, Share, SharedFile } from '@/lib/types';
import { files, safePath } from './files';
import { badRequest, HttpError, notFound, result } from './http';
import { admin, BUCKET } from './supabase';

const scrypt = promisify(crypto.scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** "salt:key" in hex; the password itself is never stored */
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 32);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const expected = Buffer.from(key, 'hex');
  const actual = await scrypt(password, Buffer.from(salt, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Wrong passwords per caller and link: after MAX_FAILS within the window, further tries are refused.
// Kept in memory, so each server instance counts on its own.
const FAIL_WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 10;
const failures = new Map<string, { count: number; since: number }>();

function assertNotThrottled(key: string): void {
  const entry = failures.get(key);
  if (entry && Date.now() - entry.since < FAIL_WINDOW_MS && entry.count >= MAX_FAILS) {
    throw new HttpError(429, 'Too many wrong passwords. Try again in 15 minutes.');
  }
}

function recordFailure(key: string): void {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.since >= FAIL_WINDOW_MS) failures.set(key, { count: 1, since: Date.now() });
  else entry.count++;
  if (failures.size > 5000) failures.clear();
}

/** Uploaded files are stored as "{CC}_{YYYY-MM}__{original name}"; people see the original name */
const displayName = (fileName: string) => (fileName.includes('__') ? fileName.split('__').slice(1).join('__') : fileName);

const isExpired = (row: { expires_at: string | null }) => Boolean(row.expires_at && new Date(row.expires_at).getTime() <= Date.now());

const toShare = (row: any): Share => ({
  id: row.id,
  title: row.title ?? null,
  files: row.files,
  hasPassword: Boolean(row.password_hash),
  expiresAt: row.expires_at ?? null,
  expired: isExpired(row),
  downloadCount: row.download_count,
  lastDownloadAt: row.last_download_at ?? null,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const table = () => admin().from('file_shares');

/** A live link, or 404 (an expired link reads as gone, so nothing about it leaks) */
async function getLive(id: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) throw notFound('This link does not exist or has been removed.');
  const { data } = await result(table().select('*').eq('id', id).maybeSingle(), 'read link');
  if (!data) throw notFound('This link does not exist or has been removed.');
  if (isExpired(data)) throw new HttpError(410, 'This link has expired.');
  return data;
}

/**
 * Share links (table file_shares): anyone with the link can download the files it holds, after
 * entering its password if it has one. Downloads go through short-lived signed URLs or a zip made
 * here, so the bucket itself stays private.
 */
export const shares = {
  async create(input: { paths: string[]; title?: string; password?: string; expiresInDays?: number | null }, createdBy: string): Promise<Share> {
    const paths = [...new Set(input.paths.map(safePath))];

    // Snapshot each file's name and size, which also proves it exists
    const byFolder = new Map<string, string[]>();
    for (const p of paths) {
      const folder = p.split('/').slice(0, -1).join('/');
      byFolder.set(folder, [...(byFolder.get(folder) ?? []), p]);
    }
    const found = new Map<string, SharedFile>();
    for (const [folder, wanted] of byFolder) {
      const { data, error } = await admin().storage.from(BUCKET).list(folder, { limit: 1000 });
      if (error) throw new HttpError(502, `List: ${error.message}`);
      for (const entry of data) {
        const path = folder ? `${folder}/${entry.name}` : entry.name;
        if (entry.id !== null && wanted.includes(path)) found.set(path, { path, name: displayName(entry.name), size: Number(entry.metadata?.size ?? 0) });
      }
    }
    const missing = paths.filter((p) => !found.has(p));
    if (missing.length) throw badRequest(`${missing.length === 1 ? 'This file no longer exists' : 'These files no longer exist'}: ${missing.join(', ')}`);

    const row = {
      id: crypto.randomBytes(16).toString('base64url'),
      title: input.title?.trim() || null,
      files: paths.map((p) => found.get(p)!),
      password_hash: input.password ? await hashPassword(input.password) : null,
      expires_at: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString() : null,
      created_by: createdBy,
    };
    const { data } = await result(table().insert(row).select('*').single(), 'create link');
    return toShare(data);
  },

  async list(): Promise<Share[]> {
    const { data } = await result(table().select('*').order('created_at', { ascending: false }).limit(500), 'list links');
    return data.map(toShare);
  },

  /** Deleting the row is what revokes the link */
  async remove(id: string): Promise<void> {
    const { count } = await result(table().delete({ count: 'exact' }).eq('id', id), 'delete link');
    if (!count) throw notFound('This link was already removed.');
  },

  /** What the public page shows before (and after) the password: the file list only once unlocked */
  async open(id: string, password: string | undefined, callerKey: string): Promise<PublicShare> {
    const row = await getLive(id);
    const base = { title: row.title ?? null, expiresAt: row.expires_at ?? null, hasPassword: Boolean(row.password_hash) };
    if (row.password_hash) {
      if (password === undefined) return { ...base, locked: true, files: [] };
      await this.checkPassword(row, password, callerKey);
    }
    return { ...base, locked: false, files: row.files as SharedFile[] };
  },

  async checkPassword(row: { id: string; password_hash: string | null }, password: string | undefined, callerKey: string): Promise<void> {
    if (!row.password_hash) return;
    const key = `${callerKey}|${row.id}`;
    assertNotThrottled(key);
    if (!password || !(await passwordMatches(password, row.password_hash))) {
      recordFailure(key);
      throw new HttpError(401, 'Wrong password.');
    }
    failures.delete(key);
  },

  /**
   * One file as a signed link, or every file as one zip. The path must be one of the link's own
   * files, so a link can never reach anything else in the bucket.
   */
  async download(id: string, password: string | undefined, path: string | undefined, callerKey: string): Promise<{ url: string } | { zip: Uint8Array; name: string }> {
    const row = await getLive(id);
    await this.checkPassword(row, password, callerKey);
    const shared = row.files as SharedFile[];

    let out: { url: string } | { zip: Uint8Array; name: string };
    if (path) {
      if (!shared.some((f) => f.path === path)) throw notFound('This file is not part of the link.');
      const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(path, 60, { download: path.split('/').pop() });
      if (error) throw /not.?found/i.test(error.message) ? notFound('This file has been deleted since the link was made.') : new HttpError(502, `Download: ${error.message}`);
      out = { url: data.signedUrl };
    } else {
      const slug = (row.title ?? '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'shared-files';
      out = { zip: await files.zip(shared.map((f) => f.path)), name: `${slug}.zip` };
    }

    // Best effort: a lost count is better than a failed download
    await table()
      .update({ download_count: (row.download_count ?? 0) + 1, last_download_at: new Date().toISOString() })
      .eq('id', id)
      .then(({ error }) => error && console.error(`Could not count a download of link ${id}: ${error.message}`));
    return out;
  },
};

/** Who is calling, for throttling wrong passwords: the first forwarded address, else "unknown" */
export function callerKeyOf(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}
