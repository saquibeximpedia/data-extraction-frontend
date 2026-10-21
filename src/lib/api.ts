import type { ExportFile, Health, Run, RunLog, RunResponse } from './types';

const TOKEN_KEY = 'tx_token';

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

export function getToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked: the session just won't survive a reload
  }
}

/** Called whenever the API rejects the token, so the app can show the login screen */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(apiBase() + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/api/auth/login')) {
    setToken('');
    onUnauthorized();
  }
  if (!res.ok) {
    throw new ApiError(body.error || `Request failed (HTTP ${res.status})`, res.status, body);
  }
  return body as T;
}

export interface ExtractBody {
  countryCode: string;
  startDate: string;
  endDate: string;
  hsCodes?: string;
  tradeType: string;
  mode?: 'complete' | 'test';
}

export const api = {
  login: (password: string) =>
    request<{ token: string; expiresIn: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),

  /** Checks the stored token is still valid */
  checkToken: () => request<{ valid: boolean }>('/api/auth/session'),

  health: () => request<Health>('/api/health'),

  /** Always runs in the background; progress shows up in the runs list */
  extract: (body: ExtractBody) =>
    request<RunResponse>('/api/extractions', { method: 'POST', body: JSON.stringify({ ...body, force: true }) }),

  autoSync: () => request<RunResponse>('/api/extractions/daily-check', { method: 'POST', body: '{}' }),

  runs: (limit = 25) => request<{ runs: Run[] }>(`/api/runs?limit=${limit}`).then((r) => r.runs),
  run: (id: string) => request<Run>(`/api/runs/${id}`),
  stopRun: (id: string) => request<{ success: boolean; message: string }>(`/api/runs/${id}/stop`, { method: 'POST' }),
  getRunLogs: (id: string) => request<{ runId: string; count: number; logs: RunLog[] }>(`/api/runs/${id}/logs`).then((r) => r.logs),

  files: () => request<{ files: ExportFile[] }>('/api/files').then((r) => r.files),

  deleteFile: (path: string) =>
    request<{ success: boolean; message: string }>(`/api/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),

  /** Downloads go through a normal link, so the token travels as a query parameter */
  downloadUrl: (relativePath: string) =>
    `${apiBase()}/api/files/download?path=${encodeURIComponent(relativePath)}&token=${encodeURIComponent(getToken())}`,
};
