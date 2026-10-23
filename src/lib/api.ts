import { supabase } from './supabase';
import type { AdminUser, Country, CountryPatch, ExportFile, Health, Me, MonthStatus, Role, Run, RunLog, RunResponse } from './types';

/**
 * Where the Express API lives. Set NEXT_PUBLIC_API_URL to override; otherwise it is
 * the host this page was opened on, port 3000 (so LAN access works without config).
 */
function apiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  return `${window.location.protocol}//${window.location.hostname}:3000`;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: any) {
    super(message);
  }
}

/** The message to show for a failed call */
export const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'The API server did not respond.');

/** Called whenever the API rejects the session, so the app can show the sign-in screen */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

/** The current Supabase access token (refreshed by supabase-js when it is about to expire) */
async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function send(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(apiBase() + path, {
    ...options,
    headers: {
      ...(typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${await token()}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) onUnauthorized();
    throw new ApiError(body.error || `Request failed (HTTP ${res.status})`, res.status, body);
  }
  return res;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return (await (await send(path, options)).json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/** Opens a URL as a download without leaving the page */
function saveFrom(url: string, name?: string): void {
  const link = Object.assign(document.createElement('a'), { href: url, rel: 'noopener', ...(name && { download: name }) });
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export interface ExtractBody {
  countryCode: string;
  startDate: string;
  endDate: string;
  hsCodes?: string;
  tradeType: string;
  mode: 'complete' | 'test';
}

export const api = {
  me: () => request<Me>('/api/auth/me'),
  health: () => request<Health>('/api/health'),

  countries: () => request<{ countries: Country[] }>('/api/countries').then((r) => r.countries),
  /** Sets a range (start..end) or a list of months to completed (or extracting) */
  markMonths: (code: string, months: ({ start: string; end: string } | { periods: string[] }) & { status?: MonthStatus }) =>
    request<{ added: number; country: Country }>(`/api/countries/${code}/months`, json('POST', months)),
  unmarkMonths: (code: string, periods: string[]) =>
    request<{ removed: number; country: Country }>(`/api/countries/${code}/months/remove`, json('POST', { periods })),

  // Admin
  updateCountry: (code: string, patch: CountryPatch) => request<Country>(`/api/countries/${code}`, json('PATCH', patch)),
  createCountry: (body: CountryPatch & { code: string; name: string; sourceUrl: string }) =>
    request<Country>('/api/countries', json('POST', body)),
  deleteCountry: (code: string) => request<{ deleted: string }>(`/api/countries/${code}`, { method: 'DELETE' }),
  users: () => request<{ users: AdminUser[] }>('/api/admin/users').then((r) => r.users),
  createUser: (email: string, password: string, role: Role) => request<AdminUser>('/api/admin/users', json('POST', { email, password, role })),
  updateUser: (id: string, patch: { role?: Role; password?: string }) => request<AdminUser>(`/api/admin/users/${id}`, json('PATCH', patch)),
  deleteUser: (id: string) => request<{ deleted: string }>(`/api/admin/users/${id}`, { method: 'DELETE' }),

  /** Runs in the background (its months are marked extracting); progress shows up on the Extractions page */
  extract: (body: ExtractBody) => request<RunResponse>('/api/extractions', json('POST', body)),

  runs: (limit = 50) => request<{ runs: Run[] }>(`/api/runs?limit=${limit}`).then((r) => r.runs),
  run: (id: string) => request<Run>(`/api/runs/${id}`),
  stopRun: (id: string) => request<{ success: boolean; message: string }>(`/api/runs/${id}/stop`, { method: 'POST' }),
  /** Only a running extraction has logs; the server drops them when it ends */
  runLogs: (id: string) => request<{ logs: RunLog[] }>(`/api/runs/${id}/logs`).then((r) => r.logs),

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

  /** Stores a file downloaded from a source website under a country and month */
  upload: (country: string, period: string, file: File) =>
    request<{ path: string }>(
      `/api/files/upload?country=${encodeURIComponent(country)}&period=${period}&name=${encodeURIComponent(file.name)}`,
      { method: 'PUT', body: file, headers: { 'Content-Type': 'application/octet-stream' } }
    ),
};
