'use client';

import Link from 'next/link';
import type { Country } from '@/lib/types';
import { fmtMonth } from '@/lib/format';
import { MONTH_LABELS, nowPeriod, yearPeriods } from '@/lib/months';
import { Icon } from './ui';

/**
 * A country's months, one row per year: completed months are green, extracting ones amber.
 * Read-only unless `onToggle` is given (the edit page), which makes months and years selectable.
 */
export function MonthGrid({
  country,
  years,
  selected,
  onToggle,
  compact,
}: {
  country: Country;
  years: number[];
  selected?: Set<string>;
  onToggle?: (periods: string[]) => void;
  compact?: boolean;
}) {
  const current = nowPeriod();
  const completed = new Set(country.completedMonths);
  const extracting = new Set(country.extractingMonths);

  return (
    <div className={`year-grid ${compact ? 'compact' : ''}`} role="group" aria-label={`${country.name} months`}>
      {years.map((year) => {
        const periods = yearPeriods(year).filter((p) => p <= current);
        const label = (
          <>
            {year}
            <span className="year-count">{periods.filter((p) => completed.has(p)).length}/12</span>
          </>
        );
        return (
          <div key={year} className="year-row">
            {onToggle ? (
              <button
                type="button"
                className="year-label"
                onClick={() => onToggle(periods)}
                title={`Select every month of ${year}`}
                aria-pressed={periods.length > 0 && periods.every((p) => selected?.has(p))}
              >
                {label}
              </button>
            ) : (
              <span className="year-label static">{label}</span>
            )}
            <div className="month-cells">
              {yearPeriods(year).map((p, i) => {
                const state = completed.has(p) ? 'done' : extracting.has(p) ? 'extracting' : '';
                const className = `month-cell ${state} ${selected?.has(p) ? 'selected' : ''} ${p > current ? 'future' : ''}`;
                const title = `${fmtMonth(p)}${state === 'done' ? ' · completed' : state ? ' · extracting' : ''}`;
                const content = (
                  <>
                    {state === 'done' && <Icon.Check size={11} />}
                    {MONTH_LABELS[i]}
                  </>
                );
                return onToggle ? (
                  <button key={p} type="button" className={className} title={title} disabled={p > current} onClick={() => onToggle([p])} aria-pressed={selected?.has(p)}>
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
      <span>
        <i className="legend-swatch done" /> Completed
      </span>
      <span>
        <i className="legend-swatch extracting" /> Extracting
      </span>
      <span>
        <i className="legend-swatch" /> Not done
      </span>
    </div>
  );
}

/** Link to the page where a country's months are changed */
export function EditMonthsLink({ code, button }: { code: string; button?: boolean }) {
  return (
    <Link href={`/countries/${code}/edit`} className={button ? 'btn btn-secondary btn-sm' : 'link'}>
      <Icon.Pencil size={13} /> Edit months
    </Link>
  );
}

/** Starts an extraction (or, for download-only countries, getting files) for a country */
export function ExtractLink({ country }: { country: Country }) {
  return (
    <Link href={`/extract?country=${country.code}`} className="btn btn-primary btn-sm" onClick={(e) => e.stopPropagation()}>
      {country.kind === 'manual' ? <Icon.Download size={14} /> : <Icon.Play size={14} />}
      {country.kind === 'manual' ? 'Get files' : 'Extract'}
    </Link>
  );
}
