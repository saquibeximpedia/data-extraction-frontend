import 'server-only';
import crypto from 'crypto';
import { promisify } from 'util';
import { displayName } from '@/lib/files';
import { badRequest, HttpError, notFound, result, throttle } from '@/lib/http';
import { admin } from '@/lib/supabase/server';
import type { PublicShare, Share, SharedFile } from '@/lib/types';
import { files, safePath } from '@/modules/files/queries';

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

// Wrong passwords per caller and link
const wrongPasswords = throttle(10, 15 * 60_000, 'Too many wrong passwords. Try again in 15 minutes.');

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

async function checkPassword(row: { id: string; password_hash: string | null }, password: string | undefined, callerKey: string): Promise<void> {
  if (!row.password_hash) return;
  const key = `${callerKey}|${row.id}`;
  wrongPasswords.check(key);
  if (!password || !(await passwordMatches(password, row.password_hash))) {
    wrongPasswords.fail(key);
    throw new HttpError(401, 'Wrong password.');
  }
  wrongPasswords.clear(key);
}

/**
 * Share links (table file_shares): anyone with the link can download the files it holds, after
 * entering its password if it has one. Downloads go through short-lived signed URLs or a zip made
 * here, so the bucket itself stays private.
 */
export const shares = {
  async create(input: { paths: string[]; title?: string; password?: string; expiresInDays?: number | null }, createdBy: string): Promise<Share & { reused: boolean }> {
    const paths = [...new Set(input.paths.map(safePath))];

    // Snapshot each file's name and size, which also proves it exists
    const found = await files.stat(paths);
    const missing = paths.filter((p) => !found.has(p));
    if (missing.length) throw badRequest(`${missing.length === 1 ? 'This file no longer exists' : 'These files no longer exist'}: ${missing.join(', ')}`);

    const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString() : null;

    // Sharing the same files again without a password gives back the person's live link for them
    // (lasting at least as long as asked) instead of a second one. A password always makes a new
    // link, since that password is the point of it.
    if (!input.password) {
      const key = [...paths].sort().join('\n');
      const { data: mine } = await result(table().select('*').eq('created_by', createdBy).is('password_hash', null), 'find links');
      const same = (mine as any[]).find((r) => !isExpired(r) && (r.files as SharedFile[]).map((f) => f.path).sort().join('\n') === key);
      if (same) {
        const longer = same.expires_at && (!expiresAt || expiresAt > same.expires_at) ? expiresAt : same.expires_at;
        const patch = { expires_at: longer, ...(input.title?.trim() ? { title: input.title.trim() } : {}) };
        const { data } = await result(table().update(patch).eq('id', same.id).select('*').single(), 'reuse link');
        return { ...toShare(data), reused: true };
      }
    }

    const row = {
      id: crypto.randomBytes(16).toString('base64url'),
      title: input.title?.trim() || null,
      files: paths.map((path): SharedFile => ({ path, name: displayName(found.get(path)!.name), size: found.get(path)!.size })),
      password_hash: input.password ? await hashPassword(input.password) : null,
      expires_at: expiresAt,
      created_by: createdBy,
    };
    const { data } = await result(table().insert(row).select('*').single(), 'create link');
    return { ...toShare(data), reused: false };
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
      await checkPassword(row, password, callerKey);
    }
    return { ...base, locked: false, files: row.files as SharedFile[] };
  },

  /**
   * One file as a signed link, or every file as one zip. The path must be one of the link's own
   * files, so a link can never reach anything else in the bucket.
   */
  async download(id: string, password: string | undefined, path: string | undefined, callerKey: string): Promise<{ url: string } | { zip: ReadableStream<Uint8Array>; name: string }> {
    const row = await getLive(id);
    await checkPassword(row, password, callerKey);
    const shared = row.files as SharedFile[];

    let out: { url: string } | { zip: ReadableStream<Uint8Array>; name: string };
    if (path) {
      if (!shared.some((f) => f.path === path)) throw notFound('This file is not part of the link.');
      out = {
        url: await files.signedUrl(path, 60).catch((err) => {
          throw err instanceof HttpError && err.status === 404 ? notFound('This file has been deleted since the link was made.') : err;
        }),
      };
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
