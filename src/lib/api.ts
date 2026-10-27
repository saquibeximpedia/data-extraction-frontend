import { supabase } from './supabase';
import type { AdminUser, Country, CountryPatch, ExportFile, ExtractorInfo, Me, MonthChange, PublicShare, Role, Run, RunLog, RunResponse, ServiceHealth, Share } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: any) {
    super(message);
  }
}

/** The message to show for a failed call */
export const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'The server did not respond.');

/** Called whenever this app's API rejects the session, so the app can show the sign-in screen */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

/** The current Supabase access token (refreshed by supabase-js when it is about to expire) */
async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function send(url: string, options: RequestInit = {}, signOutOn401 = true): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${await token()}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && signOutOn401) onUnauthorized();
    throw new ApiError(body.error || `Request failed (HTTP ${res.status})`, res.status, body);
  }
  return res;
}

const request = async <T>(url: string, options: RequestInit = {}): Promise<T> => (await (await send(url, options)).json()) as T;

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/** Opens a URL as a download without leaving the page */
function saveFrom(url: string, name?: string): void {
  const link = Object.assign(document.createElement('a'), { href: url, rel: 'noopener', ...(name && { download: name }) });
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * This app's own API (src/app/api): sign-in check, countries and months, extraction history,
 * files and accounts. Works whether or not the extraction service is running.
 */
export const api = {
  me: () => request<Me>('/api/me'),

  countries: () => request<{ countries: Country[] }>('/api/countries').then((r) => r.countries),
  /** Sets each month's status (null clears it) */
  setMonths: (code: string, changes: MonthChange[]) =>
    request<{ changed: number; country: Country }>(`/api/countries/${code}/months`, json('POST', { changes })),

  // Admin
  updateCountry: (code: string, patch: CountryPatch) => request<Country>(`/api/countries/${code}`, json('PATCH', patch)),
  createCountry: (body: CountryPatch & { code: string; name: string; sourceUrl: string }) => request<Country>('/api/countries', json('POST', body)),
  deleteCountry: (code: string) => request<{ deleted: string }>(`/api/countries/${code}`, { method: 'DELETE' }),
  users: () => request<{ users: AdminUser[] }>('/api/admin/users').then((r) => r.users),
  createUser: (email: string, password: string, role: Role) => request<AdminUser>('/api/admin/users', json('POST', { email, password, role })),
  updateUser: (id: string, patch: { role?: Role; password?: string }) => request<AdminUser>(`/api/admin/users/${id}`, json('PATCH', patch)),
  deleteUser: (id: string) => request<{ deleted: string }>(`/api/admin/users/${id}`, { method: 'DELETE' }),

  runs: (limit = 50, country?: string) => request<{ runs: Run[] }>(`/api/runs?limit=${limit}${country ? `&country=${country}` : ''}`).then((r) => r.runs),
  run: (id: string) => request<Run>(`/api/runs/${id}`),

  files: () => request<{ files: ExportFile[] }>('/api/files').then((r) => r.files),
  deleteFiles: (paths: string[]) => request<{ deleted: string[] }>('/api/files/delete', json('POST', { paths })),

  /** Downloads one file through a short-lived signed link */
  download: async (path: string) => {
    const { url } = await request<{ url: string }>(`/api/files/url?path=${encodeURIComponent(path)}`);
    saveFrom(url);
  },

  /** Downloads the selected files as one zip, keeping their country/year folders */
  downloadZip: async (paths: string[]) => {
    const res = await send('/api/files/zip', json('POST', { paths }));
    const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'trade-data.zip';
    const url = URL.createObjectURL(await res.blob());
    saveFrom(url, name);
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },

  shares: () => request<{ shares: Share[] }>('/api/shares').then((r) => r.shares),
  /** A link anyone can open to download the files; expiresInDays null means it never expires */
  createShare: (body: { paths: string[]; title?: string; password?: string; expiresInDays: number | null }) => request<Share>('/api/shares', json('POST', body)),
  deleteShare: (id: string) => request<{ deleted: string }>(`/api/shares/${id}`, { method: 'DELETE' }),

  /** Stores a file downloaded from a source website under a country and month (uploaded straight to Storage) */
  upload: async (country: string, period: string, file: File) => {
    const target = await request<{ path: string; token: string; bucket: string }>('/api/files/upload', json('POST', { country, period, name: file.name }));
    const { error } = await supabase.storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, file, { upsert: true });
    if (error) throw new ApiError(error.message, 502, {});
    return { path: target.path };
  },
};

// ------------------------------------------------------------------ share links (no sign-in)

/** The address people open for a share link */
export const shareUrl = (id: string) => `${window.location.origin}/s/${id}`;

async function publicSend(url: string, body?: unknown): Promise<Response> {
  const res = await fetch(url, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || `Request failed (HTTP ${res.status})`, res.status, data);
  }
  return res;
}

const sharePath = (id: string) => `/api/public/shares/${encodeURIComponent(id)}`;

/** What the public /s/{id} page calls: it works for anyone with the link */
export const publicShare = {
  get: (id: string) => publicSend(sharePath(id)).then((r) => r.json() as Promise<PublicShare>),
  unlock: (id: string, password: string) => publicSend(sharePath(id), { password }).then((r) => r.json() as Promise<PublicShare>),

  /** One file through a short-lived signed link */
  download: async (id: string, path: string, password?: string) => {
    const { url } = await (await publicSend(`${sharePath(id)}/download`, { path, password })).json();
    saveFrom(url);
  },

  /** Every file of the link as one zip */
  downloadAll: async (id: string, password?: string) => {
    const res = await publicSend(`${sharePath(id)}/download`, { password });
    const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'shared-files.zip';
    const url = URL.createObjectURL(await res.blob());
    saveFrom(url, name);
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },
};

// ------------------------------------------------------------------ extraction service

const SERVICE_KEY = 'extraction-service-url';

/** The extraction service URL from the build (NEXT_PUBLIC_EXTRACTION_SERVICE_URL), else localhost:3000 */
export const defaultServiceUrl = () => (process.env.NEXT_PUBLIC_EXTRACTION_SERVICE_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** The URL set in Settings on this browser, if any */
export function savedServiceUrl(): string | null {
  try {
    return localStorage.getItem(SERVICE_KEY);
  } catch {
    return null;
  }
}

export function saveServiceUrl(url: string | null): void {
  try {
    if (url) localStorage.setItem(SERVICE_KEY, url.replace(/\/+$/, ''));
    else localStorage.removeItem(SERVICE_KEY);
  } catch {
    // Storage blocked: the default URL keeps being used
  }
}

export const serviceUrl = () => savedServiceUrl() || defaultServiceUrl();

/** Whether a service answers at `base`: its health, or why it didn't */
export async function checkService(base: string): Promise<{ ok: true; health: ServiceHealth } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/api/health`, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: body?.error || `It answered with HTTP ${res.status}.` };
    if (body?.status !== 'ok') return { ok: false, error: 'Something answered, but it is not the extraction service.' };
    return { ok: true, health: body };
  } catch (err) {
    return { ok: false, error: err instanceof DOMException && err.name === 'TimeoutError' ? 'No answer within 5 seconds.' : 'Could not reach it (not running, wrong URL, or blocked).' };
  }
}

const service = <T>(path: string, options?: RequestInit) =>
  send(serviceUrl() + path, options, false).then((r) => r.json() as Promise<T>);

/**
 * The extraction service (the Node backend): it only extracts. It is called straight from the
 * browser, so a service running on this machine (localhost) works too.
 */
export const extractor = {
  countries: () => service<{ countries: ExtractorInfo[] }>('/api/countries').then((r) => r.countries),
  /** Runs in the background (its months are marked extracting) */
  extract: (body: ExtractBody) => service<RunResponse>('/api/extractions', json('POST', body)),
  /** Extractions running right now */
  liveRuns: () => service<{ runs: Run[] }>('/api/runs').then((r) => r.runs),
  stopRun: (id: string) => service<{ success: boolean }>(`/api/runs/${id}/stop`, { method: 'POST' }),
  /** Only a running extraction has logs; the service drops them when it ends */
  runLogs: (id: string) => service<{ logs: RunLog[] }>(`/api/runs/${id}/logs`).then((r) => r.logs),
};

export interface ExtractBody {
  countryCode: string;
  startDate: string;
  endDate: string;
  hsCodes?: string;
  tradeType: string;
  mode: 'complete' | 'test';
}
