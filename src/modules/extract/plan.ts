import { fmtMs, fmtNumber, plural } from '@/lib/format';
import type { ExtractorInfo, RequestCost } from '@/lib/types';

// What a range of months costs at the source, and which range is the best buy: some sources
// return a whole year per request, others need a request (or thousands) for every month.

/** A run longer than this is worth splitting: a failure late in it costs the most to redo */
const LONG_RUN_MS = 2 * 60 * 60 * 1000;

/** The cost of the data set picked; null when it isn't known (an older service, or custom codes) */
export function costOf(info: ExtractorInfo, mode: 'complete' | 'test'): RequestCost | null {
  const cost = info.requests?.[mode];
  return cost && cost.month > 0 ? cost : null;
}

/** Whether one request covers a whole calendar year, from whichever data set has codes */
export function batchesYears(info: ExtractorInfo): boolean | null {
  const cost = costOf(info, 'complete') ?? costOf(info, 'test');
  return cost ? cost.year < cost.month * 12 : null;
}

/** Requests for these months and flows: a year-batched source pays for each calendar year touched once */
export function requestCount(cost: RequestCost, months: string[], flows: number): number {
  const perFlow = cost.year < cost.month * 12 ? new Set(months.map((p) => p.slice(0, 4))).size * cost.year : months.length * cost.month;
  return perFlow * flows;
}

/** The least time `requests` can take under the source's rate limit (null: it has none) */
export function minDuration(requests: number, info: ExtractorInfo): number | null {
  const perMinute = info.rateLimitPerMinute ?? 60;
  return perMinute > 0 ? (requests / perMinute) * 60_000 : null;
}

/**
 * The whole calendar years around `months`, kept within the source's first month and the latest
 * it should have out; null when they already are whole years (or no range is picked)
 */
export function wholeYears(months: string[], startPeriod: string | null | undefined, latest: string): [string, string] | null {
  if (!months.length) return null;
  let from = `${months[0].slice(0, 4)}-01`;
  let to = `${months[months.length - 1].slice(0, 4)}-12`;
  if (startPeriod && from < startPeriod) from = startPeriod;
  if (latest && to > latest) to = latest;
  return from === months[0] && to === months[months.length - 1] ? null : [from, to];
}

/** The advice under the months: which range costs least for this source, and how much to take per run */
export function rangeAdvice(info: ExtractorInfo, cost: RequestCost | null, flows: number): string {
  if (info.sourceFiles) return 'Each month and flow is its own download. A year or less at a time keeps the browser’s download prompts manageable.';
  const byYear = batchesYears(info);
  if (byYear === null) return '';

  if (byYear) {
    const perYear = cost ? ` (${plural(cost.year * flows, 'request')})` : '';
    return (
      `${info.name} returns a whole calendar year per request, so one month costs as much as twelve${perYear}. ` +
      'Pick whole years: January to December, or to the latest month. Several years in one run is fine; each adds the same again. ' +
      'A range that only touches the edge of a year still pays for that whole year.'
    );
  }

  const perMonth = cost ? cost.month * flows : null;
  const intro = perMonth ? `Each month is its own ${plural(perMonth, 'request')} here, so the cost grows with every month added.` : 'Each month is fetched on its own here, so the cost grows with every month added.';
  const monthMs = perMonth ? minDuration(perMonth, info) : null;
  if (monthMs === null) return `${intro} Long ranges work; splitting them into a year or less per run makes a failed run quicker to redo.`;
  if (monthMs * 36 <= LONG_RUN_MS) return `${intro} The source’s rate limit allows several years in one run; a slow source can still take longer.`;
  const months = Math.max(1, Math.floor(LONG_RUN_MS / monthMs));
  return months === 1
    ? `${intro} One month already takes at least ${fmtMs(monthMs)} at the source’s limit, so run one month at a time.`
    : `${intro} At the source’s limit a month takes at least ${fmtMs(monthMs)}; about ${plural(Math.min(months, 12), 'month')} per run keeps each run within two hours.`;
}

/** "1,734 requests · at least 1h 55m" for the run summary */
export function describeCost(requests: number, info: ExtractorInfo): string {
  const ms = minDuration(requests, info);
  return `${fmtNumber(requests)} request${requests === 1 ? '' : 's'}${ms !== null && ms >= 60_000 ? ` · at least ${fmtMs(ms)}` : ''}`;
}
