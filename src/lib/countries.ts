import type { Country } from './types';

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function fmtPeriod(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function calculatePeriods(lagMonths: number, publishDay: number, lookbackMonths = 6, today = new Date()): string[] {
  const isReleased = today.getDate() >= publishDay;
  const target = addMonths(today.getFullYear(), today.getMonth() + 1, -(lagMonths + (isReleased ? 0 : 1)));

  const periods: string[] = [];
  for (let i = lookbackMonths - 1; i >= 0; i--) {
    const p = addMonths(target.year, target.month, -i);
    periods.push(fmtPeriod(p.year, p.month));
  }
  return periods;
}

export const SUPPORTED_COUNTRIES: Country[] = [
  {
    code: 'THA',
    name: 'Thailand',
    enabled: true,
    missingConfig: [],
    lagMonths: 2,
    updateDayOfMonth: 1,
    supportedTradeTypes: ['IMPORT', 'EXPORT'],
    rateLimitPerMinute: 60,
    autoSyncPeriods: calculatePeriods(2, 1),
    hsCodeCount: 21721,
    invalidHsCodeCount: 0,
    testHsCodeCount: 20,
    hasTestCodes: true,
  },
  {
    code: 'IDN',
    name: 'Indonesia',
    enabled: true,
    missingConfig: [],
    lagMonths: 2,
    updateDayOfMonth: 15,
    supportedTradeTypes: ['IMPORT', 'EXPORT'],
    rateLimitPerMinute: 60,
    autoSyncPeriods: calculatePeriods(2, 15),
    hsCodeCount: 9055,
    invalidHsCodeCount: 0,
    testHsCodeCount: 20,
    hasTestCodes: true,
  },
];
