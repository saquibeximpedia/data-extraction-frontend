import type { Country } from './types';

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** This month as "YYYY-MM" */
export const nowPeriod = () => `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;

/** The 12 periods of a year, "2026-01" … "2026-12" */
export const yearPeriods = (year: number) => MONTH_LABELS.map((_, i) => `${year}-${pad(i + 1)}`);

/** addMonths("2026-01", -1) -> "2025-12" */
export function addMonths(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const i = y * 12 + (m - 1) + delta;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

/** Years to show for a country, newest first: from its first marked month (at least last year) to this year, plus `extra` earlier */
export function yearsFor(country: Country, extra = 0): number[] {
  const thisYear = new Date().getFullYear();
  const first = [...country.completedMonths, ...country.extractingMonths].sort()[0];
  const from = Math.min(first ? Number(first.slice(0, 4)) : thisYear, thisYear - 1) - extra;
  return Array.from({ length: thisYear - from + 1 }, (_, i) => thisYear - i);
}

/** The latest month the source should have published by now */
export const latestPublished = (country: Country) => country.recentPeriods[country.recentPeriods.length - 1] ?? '';
