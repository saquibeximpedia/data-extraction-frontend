/** plural(3, 'file') -> "3 files" */
export const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** "IMPORT" -> "Import", "COMPLETED" -> "Completed" */
export const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/** ["IMPORT", "EXPORT"] -> "Import & Export" */
export const fmtFlows = (flows: string[]) => (flows.length ? flows.map(capitalize).join(' & ') : '—');

export function fmtDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

/** "2026-08" -> "Aug 2026" */
export function fmtMonth(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** "2026-08" -> "Aug" */
const fmtMonthOnly = (period: string) => new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1).toLocaleDateString(undefined, { month: 'short' });

/** "3 min ago", "2 h ago", "yesterday"; falls back to the date after a week */
export function fmtRelative(value?: string | null): string {
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

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** 75s -> "1m 15s"; 2h 5m -> "2h 5m" */
export function fmtMs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export const fmtDuration = (from: string, to: string) => fmtMs(new Date(to).getTime() - new Date(from).getTime());

/** First and last of the periods: "Jul – Sep 2026", "Nov 2025 – Feb 2026", or one month once */
export function fmtRange(periods: string[]): string {
  if (!periods.length) return '';
  const [first, last] = [periods[0], periods[periods.length - 1]].sort();
  if (first === last) return fmtMonth(first);
  if (first.slice(0, 4) === last.slice(0, 4)) return `${fmtMonthOnly(first)} – ${fmtMonth(last)}`;
  return `${fmtMonth(first)} – ${fmtMonth(last)}`;
}

/** The site's host name, e.g. "www.stats.gov" */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'source';
  }
}

/** What a run covered, e.g. "ZAF · Jan – Sep 2026 · 10,008 saved codes · import & export" */
export function describePlan(plan: { countryCode: string; periods?: string[]; tradeTypes?: string[]; hsCodeSource?: string; hsCodeCount?: number; hsCodes?: string[] }): string {
  const count = plan.hsCodeCount ?? plan.hsCodes?.length;
  const kind = plan.hsCodeSource === 'custom' ? 'custom code' : plan.hsCodeSource === 'test' ? 'test code' : 'saved code';
  const codes = count === undefined ? '' : plural(count, kind);
  const flows = plan.tradeTypes?.length ? plan.tradeTypes.map((t) => t.toLowerCase()).join(' & ') : '';
  return [plan.countryCode, fmtRange(plan.periods ?? []), codes, flows].filter(Boolean).join(' · ');
}
