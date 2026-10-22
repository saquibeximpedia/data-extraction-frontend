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

export const TRIGGER_LABELS: Record<string, string> = {
  SCHEDULED: 'Daily schedule (retired)',
  AUTO_SYNC_API: 'Daily check (retired)',
  MANUAL_EXTRACT: 'Extraction',
};

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function fmtDuration(from: string, to: string): string {
  const s = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/** "2026-01"…"2026-09" -> "Jan 2026 – Sep 2026" (one month shows once) */
export function fmtRange(periods: string[]): string {
  if (!periods.length) return '';
  const first = periods[0];
  const last = periods[periods.length - 1];
  return first === last ? fmtMonth(first) : `${fmtMonth(first)} – ${fmtMonth(last)}`;
}

/** What a run covered, e.g. "ZAF · Jan 2026 – Sep 2026 · 10,008 saved codes · import & export" */
export function describePlan(plan: { countryCode: string; periods?: string[]; tradeTypes?: string[]; hsCodeSource?: string; hsCodeCount?: number; hsCodes?: string[] }): string {
  const count = plan.hsCodeCount ?? plan.hsCodes?.length;
  const codes =
    count === undefined
      ? ''
      : plan.hsCodeSource === 'custom'
        ? `${count.toLocaleString()} custom code${count === 1 ? '' : 's'}`
        : `${count.toLocaleString()} ${plan.hsCodeSource === 'test' ? 'test' : 'saved'} codes`;
  const flows = plan.tradeTypes?.length ? plan.tradeTypes.map((t) => t.toLowerCase()).join(' & ') : '';
  return [plan.countryCode, fmtRange(plan.periods ?? []), codes, flows].filter(Boolean).join(' · ');
}
