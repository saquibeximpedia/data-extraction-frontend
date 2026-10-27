import type { Country } from './types';

// Month helpers shared by the pages and the server routes. A period is "YYYY-MM".

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isPeriod = (value: string) => PERIOD_RE.test(value);

export const periodOfDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

/** This month as "YYYY-MM" */
export const nowPeriod = () => periodOfDate(new Date());

/** The 12 periods of a year, "2026-01" … "2026-12" */
export const yearPeriods = (year: number) => MONTH_LABELS.map((_, i) => `${year}-${pad(i + 1)}`);

/** addMonths("2026-01", -1) -> "2025-12" */
export function addMonths(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const i = y * 12 + (m - 1) + delta;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

/** monthsBetween("2026-01", "2026-04") -> 3 */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** Inclusive, ascending months from start to end (either order) */
export function periodRange(start: string, end: string): string[] {
  const [lo, hi] = [start, end].sort();
  const out: string[] = [];
  for (let p = lo; p <= hi; p = addMonths(p, 1)) out.push(p);
  return out;
}

/**
 * The `count` most recent months a source should have published by `today`, oldest first.
 * A 1-month lag publishing on the 15th has September out from October 15th; before that, August.
 */
export function recentPublishedPeriods(lagMonths: number, publishDay: number, count: number, today = new Date()): string[] {
  const released = today.getDate() >= publishDay;
  const latest = addMonths(periodOfDate(today), -(lagMonths + (released ? 0 : 1)));
  return periodRange(addMonths(latest, -(count - 1)), latest);
}

/** Years to show for a country, newest first: from its first marked month (at least last year) to this year, plus any `added` */
export function yearsFor(country: Country, added: number[] = []): number[] {
  const thisYear = new Date().getFullYear();
  const first = [...country.completedMonths, ...country.extractingMonths].sort()[0];
  const from = Math.min(first ? Number(first.slice(0, 4)) : thisYear, thisYear - 1);
  const base = Array.from({ length: thisYear - from + 1 }, (_, i) => thisYear - i);
  return [...new Set([...base, ...added])].sort((a, b) => b - a);
}

/** Earlier years that can be added to a country's months, newest first: back to its start, or 15 years */
export function addableYears(country: Country, shown: number[]): number[] {
  const thisYear = new Date().getFullYear();
  const earliest = country.startPeriod ? Number(country.startPeriod.slice(0, 4)) : thisYear - 15;
  return Array.from({ length: Math.max(0, thisYear - earliest + 1) }, (_, i) => thisYear - i).filter((y) => !shown.includes(y));
}

/** The latest month the source should have published by now */
export const latestPublished = (country: Country) => country.recentPeriods[country.recentPeriods.length - 1] ?? '';

/**
 * Published months still to extract (or upload), oldest first: those after the latest completed
 * month up to the latest published, skipping months already extracting. With nothing completed
 * yet, only the latest published month. Never before the country's start month; at most `max` months.
 */
export function dueMonths(country: Country, max = 24): string[] {
  const latest = latestPublished(country);
  if (!latest) return [];
  let from = country.latestCompleted ? addMonths(country.latestCompleted, 1) : latest;
  if (country.startPeriod && from < country.startPeriod) from = country.startPeriod;
  if (from > latest) return [];
  const capped = monthsBetween(from, latest) >= max ? addMonths(latest, -(max - 1)) : from;
  return periodRange(capped, latest).filter((p) => !country.extractingMonths.includes(p));
}

/** A month's status for a country */
export function monthState(country: Country, period: string): MonthState {
  if (country.completedMonths.includes(period)) return 'completed';
  if (country.extractingMonths.includes(period)) return 'extracting';
  return 'none';
}

export type MonthState = 'completed' | 'extracting' | 'none';

/** A direct file link for a month: "https://x.gov/trade_{YYYY}{MM}.xlsx" for 2026-08 → "https://x.gov/trade_202608.xlsx" ({YY} 26, {M} 8) */
export function fileUrlFor(template: string, period: string): string {
  const [yyyy, mm] = period.split('-');
  return template.replace(/\{YYYY\}/g, yyyy).replace(/\{YY\}/g, yyyy.slice(2)).replace(/\{MM\}/g, mm).replace(/\{M\}/g, String(Number(mm)));
}
