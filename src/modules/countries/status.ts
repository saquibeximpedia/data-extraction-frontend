import type { Tone } from '@/components/ui/badge';
import { fmtMonth, fmtRange, plural } from '@/lib/format';
import { dueMonths, latestPublished, monthsBetween } from '@/lib/months';
import { isRunning, runPeriods } from '@/lib/runs';
import type { Country, Run } from '@/lib/types';

/**
 * What a country needs next, in order of priority:
 *  review   months an extraction finished for: check the files, then mark them completed
 *  running  an extraction is working on its months right now
 *  due      published months not done yet: extract them (or upload, for download-only countries)
 *  done     up to date with what the source has published
 */
export type NextStep =
  | { kind: 'review'; periods: string[] }
  | { kind: 'running'; run: Run; periods: string[] }
  | { kind: 'due'; periods: string[] }
  | { kind: 'done' };

export interface CountryStatus {
  /** The latest month the source should have out ('' when unknown) */
  latest: string;
  /** Months the latest completed one is behind `latest`; null with nothing completed */
  behind: number | null;
  due: string[];
  /** Extracting months no running extraction is working on */
  review: string[];
  running: { run: Run; periods: string[] } | null;
  next: NextStep;
}

export function countryStatus(country: Country, runs: Run[]): CountryStatus {
  const latest = latestPublished(country);
  const behind = latest && country.latestCompleted ? Math.max(0, monthsBetween(country.latestCompleted, latest)) : null;
  const due = dueMonths(country);

  const live = runs.filter(isRunning).find((r) => runPeriods(r, country.code).length > 0);
  const livePeriods = live ? runPeriods(live, country.code) : [];
  const running = live ? { run: live, periods: livePeriods } : null;
  const review = country.extractingMonths.filter((p) => !livePeriods.includes(p));

  const next: NextStep = review.length
    ? { kind: 'review', periods: review }
    : running
      ? { kind: 'running', ...running }
      : due.length
        ? { kind: 'due', periods: due }
        : { kind: 'done' };

  return { latest, behind, due, review, running, next };
}

/** "Jul 2026" for one month, "3 months" for more */
export const monthsWord = (periods: string[]) => (periods.length === 1 ? fmtMonth(periods[0]) : plural(periods.length, 'month'));

/** One line saying what a country needs next, and how urgent it is */
export function describeStep(country: Country, status: CountryStatus): { text: string; tone: Tone } {
  const { next } = status;
  switch (next.kind) {
    case 'review':
      return { text: `${fmtRange(next.periods)} extracted: check the files, then mark ${next.periods.length === 1 ? 'it' : 'them'} completed`, tone: 'amber' };
    case 'running':
      return { text: `Extracting ${fmtRange(next.periods)} now`, tone: 'blue' };
    case 'due': {
      const verb = country.kind === 'manual' ? 'to upload' : 'to extract';
      if (status.behind === null) return { text: `Nothing completed yet · ${fmtMonth(next.periods[next.periods.length - 1])} is out`, tone: 'neutral' };
      return { text: `${fmtRange(next.periods)} ${verb} (${plural(next.periods.length, 'month')} behind)`, tone: 'neutral' };
    }
    case 'done':
      return { text: 'Up to date with the source', tone: 'green' };
  }
}

/** The same, short enough for a table cell */
export function shortStep(status: CountryStatus): { text: string; tone: Tone } {
  const { next } = status;
  switch (next.kind) {
    case 'review':
      return { text: `${monthsWord(next.periods)} to check`, tone: 'amber' };
    case 'running':
      return { text: `Extracting ${monthsWord(next.periods)}`, tone: 'blue' };
    case 'due':
      return { text: status.behind === null ? 'Nothing completed yet' : `${monthsWord(next.periods)} due`, tone: 'neutral' };
    case 'done':
      return { text: 'Up to date', tone: 'green' };
  }
}
