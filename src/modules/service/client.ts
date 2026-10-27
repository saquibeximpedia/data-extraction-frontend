import { AppError } from '@/lib/result';
import { supabase } from '@/lib/supabase/browser';
import type { AppSettings, ExtractorInfo, Run, RunLog, RunOptions, RunResponse, ServiceHealth } from '@/lib/types';

// The extraction service (the Node backend) only extracts. The browser calls it directly, so a
// service on this machine (localhost) works, and the service sees each browser's real IP for ALLOWED_IPS.

const SERVICE_KEY = 'extraction-service-url';

/** The extraction service URL from the build (NEXT_PUBLIC_EXTRACTION_SERVICE_URL), else localhost:3000 */
export const defaultServiceUrl = () => (process.env.NEXT_PUBLIC_EXTRACTION_SERVICE_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** The URL set on the Extraction service page in this browser, if any */
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

/** Calls the service with the signed-in person's Supabase token, which it verifies */
async function service<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = (await supabase.auth.getSession()).data.session?.access_token ?? '';
  const res = await fetch(serviceUrl() + path, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}`, ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AppError(body.error || `Request failed (HTTP ${res.status})`, res.status, body);
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export interface SettingsResponse {
  settings: AppSettings;
  defaults: AppSettings;
}

export interface ExtractBody {
  countryCode: string;
  startDate: string;
  endDate: string;
  hsCodes?: string;
  tradeType: string;
  mode: 'complete' | 'test';
  options?: RunOptions;
}

export const extractor = {
  countries: () => service<{ countries: ExtractorInfo[] }>('/api/countries').then((r) => r.countries),
  /** Runs in the background (its months are marked extracting) */
  extract: (body: ExtractBody) => service<RunResponse>('/api/extractions', json('POST', body)),
  /** Extractions running right now */
  liveRuns: () => service<{ runs: Run[] }>('/api/runs').then((r) => r.runs),
  stopRun: (id: string) => service<{ success: boolean }>(`/api/runs/${id}/stop`, { method: 'POST' }),
  /** Only a running extraction has logs; the service drops them when it ends */
  runLogs: (id: string) => service<{ logs: RunLog[] }>(`/api/runs/${id}/logs`).then((r) => r.logs),
  /** The extraction settings in force, and their .env defaults */
  settings: () => service<SettingsResponse>('/api/settings'),
  /** Admins only; applies from the next request on */
  saveSettings: (patch: Partial<AppSettings>) => service<SettingsResponse>('/api/settings', json('PUT', patch)),
};
