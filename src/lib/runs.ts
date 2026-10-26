import type { Tone } from '@/components/ui/badge';
import { describePlan, fmtDuration, plural } from './format';
import type { Run } from './types';

// Helpers for extraction runs, shared by every page that lists or shows them

export const RUN_TONE: Record<Run['status'], Tone> = { COMPLETED: 'green', RUNNING: 'blue', FAILED: 'red', INTERRUPTED: 'amber', STOPPED: 'amber' };

export const isRunning = (run: Run) => run.status === 'RUNNING';

export const describeRun = (run: Run) => run.params?.plans?.map(describePlan).join('; ') || 'Extraction';

export const fmtRecords = (run: Run) => (run.stats.records === undefined ? '—' : run.stats.records.toLocaleString());

export const timeTaken = (run: Run) => (run.finishedAt ? fmtDuration(run.startedAt, run.finishedAt) : '—');

/** Requests the run made or will make */
export const requestCount = (run: Run) => {
  const s = run.stats;
  return Math.max(s.planned ?? 0, s.completed + s.noData + s.failed + s.skipped);
};

/** Flags and problems worth a person's attention */
export function runNotes(run: Run): { tone: 'amber' | 'red'; text: string }[] {
  const s = run.stats;
  return [
    ...(s.flags ?? []).map((f) => ({ tone: 'amber' as const, text: f.message })),
    ...Object.entries(s.invalidHsCodes ?? {}).map(([k, v]) => ({ tone: 'amber' as const, text: `${k}: ${plural(v.length, 'invalid HS code')} skipped` })),
    ...(run.error ? [{ tone: 'red' as const, text: run.error }] : []),
  ];
}

export const needsAttention = (r: Run) => r.status === 'FAILED' || r.status === 'INTERRUPTED' || r.stats.failed > 0 || (r.stats.flags?.length ?? 0) > 0;

/** The months a run covers for one country (empty when it doesn't cover the country) */
export const runPeriods = (run: Run, code: string) => run.params?.plans?.find((p) => p.countryCode === code)?.periods ?? [];

/** Countries a run covers */
export const runCountries = (run: Run) => (run.params?.plans ?? []).map((p) => p.countryCode);
