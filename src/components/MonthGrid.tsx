'use client';

import type { Country } from '@/lib/types';
import { fmtMonth, fmtRange } from '@/lib/format';
import { MONTH_LABELS, monthState, nowPeriod, yearPeriods, type MonthState } from '@/lib/months';

export const STATE_LABEL: Record<MonthState, string> = { completed: 'Completed', extracting: 'Extracting', none: 'Not done' };

/** Edit mode of the grid (see MonthEditor): clicking a month moves it to its next status */
export interface MonthEdit {
  /** Month → its staged status, for months whose status will change on save */
  staged: Map<string, MonthState>;
  onCycle: (period: string) => void;
}

/**
 * A country's months, one row per year: completed months are green, extracting ones amber.
 * Read-only unless `edit` is given, which makes each month a button that cycles its status.
 */
export function MonthGrid({ country, years, edit }: { country: Country; years: number[]; edit?: MonthEdit }) {
  const current = nowPeriod();
  const stateOf = (p: string) => edit?.staged.get(p) ?? monthState(country, p);

  return (
    <div className={`year-grid ${edit ? 'editing' : ''}`} role="group" aria-label={`${country.name} months`}>
      {years.map((year) => {
        const periods = yearPeriods(year).filter((p) => p <= current);
        const done = periods.filter((p) => stateOf(p) === 'completed').length;
        return (
          <div key={year} className="year-row">
            <span className="year-label">
              <span>{year}</span>
              <span className="year-count">
                {done}/{periods.length}
              </span>
            </span>
            <div className="month-cells">
              {yearPeriods(year).map((p, i) => {
                const state = stateOf(p);
                const changed = edit?.staged.has(p);
                const future = p > current;
                const className = `month-cell state-${state} ${changed ? 'changed' : ''} ${future ? 'future' : ''}`;
                const title = `${fmtMonth(p)} · ${STATE_LABEL[state]}${changed ? ` (was ${STATE_LABEL[monthState(country, p)].toLowerCase()})` : ''}`;
                return edit ? (
                  <button key={p} type="button" className={className} title={title} aria-label={title} disabled={future} onClick={() => edit.onCycle(p)}>
                    {MONTH_LABELS[i]}
                  </button>
                ) : (
                  <span key={p} className={className} title={title}>
                    {MONTH_LABELS[i]}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MonthLegend() {
  return (
    <div className="month-legend">
      {(['completed', 'extracting', 'none'] as const).map((s) => (
        <span key={s}>
          <i className={`legend-swatch state-${s}`} /> {STATE_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

/** The latest months the source should have out, as a row of thin bars (oldest first) */
export function MonthStrip({ country }: { country: Country }) {
  return (
    <div className="month-strip" aria-label={`${country.name}, last ${country.recentPeriods.length} published months`}>
      {country.recentPeriods.map((p) => {
        const state = monthState(country, p);
        return <span key={p} className={`strip-cell state-${state}`} title={`${fmtMonth(p)} · ${STATE_LABEL[state]}`} />;
      })}
    </div>
  );
}

/** The last 12 published months with their names: the context for picking months to extract */
export function RecentMonths({ country }: { country: Country }) {
  const periods = country.recentPeriods.slice(-12);
  return (
    <div className="recent-months" role="group" aria-label={`${country.name}, ${fmtRange(periods)}`}>
      {periods.map((p) => {
        const state = monthState(country, p);
        const month = MONTH_LABELS[Number(p.slice(5, 7)) - 1];
        return (
          <span key={p} className={`recent-month state-${state} ${month === 'Jan' ? 'new-year' : ''}`} title={`${fmtMonth(p)} · ${STATE_LABEL[state]}`}>
            {month}
          </span>
        );
      })}
    </div>
  );
}
