export function fmtDate(value?: string): string {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

/** "2026-08" -> "Aug 2026" */
export function fmtMonth(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** "3 min ago", "2 h ago", "yesterday"; falls back to the date after a week */
export function fmtRelative(value?: string): string {
  if (!value) return '';
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 172800) return 'yesterday';
  if (diff < 604800) return `${Math.round(diff / 86400)} days ago`;
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** Turns common cron shapes into words, e.g. "0 3 * * *" -> "every day at 03:00" */
export function describeCron(cron: string): string {
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5 || isNaN(Number(p[0])) || isNaN(Number(p[1]))) return `on cron "${cron}"`;
  const time = `${p[1].padStart(2, '0')}:${p[0].padStart(2, '0')}`;
  if (p[2] === '*' && p[3] === '*' && p[4] === '*') return `every day at ${time}`;
  if (p[3] === '*' && p[4] === '*' && !isNaN(Number(p[2]))) return `on day ${p[2]} of each month at ${time}`;
  return `on cron "${cron}"`;
}

export const TRIGGER_LABELS: Record<string, string> = {
  SCHEDULED: 'Daily schedule',
  AUTO_SYNC_API: 'Daily check (manual)',
  MANUAL_EXTRACT: 'Manual extraction',
};

export const HS_RULES: Record<string, string> = {
  IDN: 'Indonesia needs 8-digit codes.',
  THA: 'Thailand accepts 4 to 11 digits.',
};

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function fmtDuration(from: string, to: string): string {
  const s = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
