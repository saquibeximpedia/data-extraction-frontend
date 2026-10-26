'use client';

import type { Country } from '@/lib/types';
import { fmtMonth } from '@/lib/format';
import { MONTH_LABELS, monthState, nowPeriod, yearPeriods, type MonthState } from '@/lib/months';
import { Icon } from './ui';

const STATE_LABEL: Record<MonthState, string> = { completed: 'Completed', extracting: 'Extracting', none: 'Not done' };

/** Painting handlers: the edit mode of the grid (see MonthPainter) */
export interface PaintHandlers {
  /** Month → its staged status, for months whose status will change on save */
  staged: Map<string, MonthState>;
  onPress: (period: string, e: React.PointerEvent | React.MouseEvent) => void;
  onYear: (periods: string[]) => void;
}

/**
 * A country's months, one row per year: completed months are green, extracting ones amber.
 * Read-only unless `paint` is given, which makes months and years paintable.
 */
export function MonthGrid({ country, years, paint, compact }: { country: Country; years: number[]; paint?: PaintHandlers; compact?: boolean }) {
  const current = nowPeriod();
  const stateOf = (p: string) => paint?.staged.get(p) ?? monthState(country, p);

  return (
    <div className={`year-grid ${compact ? 'compact' : ''} ${paint ? 'painting' : ''}`} role="group" aria-label={`${country.name} months`}>
      {years.map((year) => {
        const periods = yearPeriods(year).filter((p) => p <= current);
        const done = periods.filter((p) => stateOf(p) === 'completed').length;
        const label = (
          <>
            <span>{year}</span>
            <span className="year-count">
              {done}/{periods.length}
            </span>
          </>
        );
        return (
          <div key={year} className="year-row">
            {paint ? (
              <button type="button" className="year-label" onClick={() => paint.onYear(periods)} title={`Paint every month of ${year}`}>
                {label}
              </button>
            ) : (
              <span className="year-label static">{label}</span>
            )}
            <div className="month-cells">
              {yearPeriods(year).map((p, i) => {
                const state = stateOf(p);
                const changed = paint?.staged.has(p);
                const future = p > current;
                const className = `month-cell state-${state} ${changed ? 'changed' : ''} ${future ? 'future' : ''}`;
                const title = `${fmtMonth(p)} · ${STATE_LABEL[state]}${changed ? ` (was ${STATE_LABEL[monthState(country, p)].toLowerCase()})` : ''}`;
                const content = (
                  <>
                    {state === 'completed' && <Icon.Check size={11} />}
                    {MONTH_LABELS[i]}
                  </>
                );
                return paint ? (
                  <button
                    key={p}
                    type="button"
                    data-period={p}
                    className={className}
                    title={title}
                    disabled={future}
                    onPointerDown={(e) => paint.onPress(p, e)}
                    // Keyboard (Enter/Space) clicks have detail 0; pointer presses are handled above
                    onClick={(e) => e.detail === 0 && paint.onPress(p, e)}
                  >
                    {content}
                  </button>
                ) : (
                  <span key={p} className={className} title={title}>
                    {content}
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

/** The latest months the source should have out, as a row of small squares (oldest first) */
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
