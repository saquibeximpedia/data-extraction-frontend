import { dueMonths, latestPublished, monthsBetween } from './months';
import { isRunning, runPeriods } from './runs';
import type { Country, Run } from './types';

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

export function countryStatus(country: Country, runs: Run[] | null): CountryStatus {
  const latest = latestPublished(country);
  const behind = latest && country.latestCompleted ? Math.max(0, monthsBetween(country.latestCompleted, latest)) : null;
  const due = dueMonths(country);

  const live = (runs ?? []).filter(isRunning).find((r) => runPeriods(r, country.code).length > 0);
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
