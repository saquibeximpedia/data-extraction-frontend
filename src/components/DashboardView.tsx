'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Country } from '@/lib/types';
import { fmtMonth, fmtRange, fmtRelative } from '@/lib/format';
import { Badge, Button, CodeAvatar, Icon, MonthRangePicker, Skeleton, useToast } from './ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const nowPeriod = () => `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;

/** Top of the dashboard: every country with its latest completed month, one click to its card */
function LatestStrip({ countries }: { countries: Country[] }) {
  return (
    <div className="latest-strip reveal" style={{ '--i': 1 } as React.CSSProperties}>
      {countries.map((c) => (
        <a key={c.code} href={`#country-${c.code}`} className="latest-chip glass">
          <CodeAvatar code={c.code} muted={!c.enabled} />
          <span>
            <span className="cell-strong">{c.name}</span>
            <span className="latest-month">{c.latestCompleted ? `Latest: ${fmtMonth(c.latestCompleted)}` : 'No months marked'}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

function CountryCard({ country, index }: { country: Country; index: number }) {
  const { putCountry } = useApp();
  const toast = useToast();
  const current = nowPeriod();
  const thisYear = Number(current.slice(0, 4));
  const completed = useMemo(() => new Set(country.completedMonths), [country.completedMonths]);
  const firstMarkedYear = country.completedMonths.length ? Number(country.completedMonths[0].slice(0, 4)) : thisYear - 1;
  const [extraYears, setExtraYears] = useState(0);
  const years = Array.from({ length: thisYear - Math.min(firstMarkedYear, thisYear - 1) + 1 + extraYears }, (_, i) => thisYear - i);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [busy, setBusy] = useState<'mark' | 'unmark' | 'range' | null>(null);

  const toggle = (periods: string[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = periods.every((p) => next.has(p));
      for (const p of periods) allOn ? next.delete(p) : next.add(p);
      return next;
    });

  const selectedList = [...selected].sort();
  const selectedDone = selectedList.filter((p) => completed.has(p));
  const selectedOpen = selectedList.filter((p) => !completed.has(p));

  async function act(kind: 'mark' | 'unmark' | 'range') {
    setBusy(kind);
    try {
      if (kind === 'unmark') {
        const { removed, country: updated } = await api.unmarkMonths(country.code, selectedDone);
        putCountry(updated);
        toast('ok', 'Months unmarked', `${country.name}: ${removed} month${removed === 1 ? '' : 's'}`);
        setSelected(new Set());
      } else {
        const body = kind === 'range' ? { start: rangeStart, end: rangeEnd } : { periods: selectedOpen };
        const { added, country: updated } = await api.markMonths(country.code, body);
        putCountry(updated);
        toast('ok', 'Marked completed', `${country.name}: ${added} month${added === 1 ? '' : 's'}${kind === 'range' ? ` (${fmtRange([rangeStart, rangeEnd])})` : ''}`);
        if (kind === 'range') {
          setRangeStart('');
          setRangeEnd('');
        } else {
          setSelected(new Set());
        }
      }
    } catch (err) {
      toast('err', 'Could not save', err instanceof ApiError ? err.message : 'The API server did not respond.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id={`country-${country.code}`} className="panel glass country-card reveal" style={{ '--i': index + 2 } as React.CSSProperties}>
      <div className="panel-head country-card-head">
        <div className="source-title">
          <CodeAvatar code={country.code} muted={!country.enabled} />
          <div>
            <h2 className="panel-title">
              {country.name} {country.kind === 'manual' && <Badge tone="blue">Download-only</Badge>}
            </h2>
            <p className="panel-desc">
              {country.latestCompleted ? (
                <>
                  Latest completed <b>{fmtMonth(country.latestCompleted)}</b> · {country.completedMonths.length} month{country.completedMonths.length === 1 ? '' : 's'}
                </>
              ) : (
                'No months marked completed yet'
              )}
              {country.lastExtractedAt && ` · last extraction ${fmtRelative(country.lastExtractedAt)}`}
            </p>
          </div>
        </div>
        <Link href={`/extract?country=${country.code}`} className="btn btn-primary btn-sm">
          {country.kind === 'manual' ? <Icon.Download size={14} /> : <Icon.Play size={14} />}
          {country.kind === 'manual' ? 'Get files' : 'Extract'}
        </Link>
      </div>

      <div className="year-grid" role="group" aria-label={`${country.name} months`}>
        {years.map((year) => {
          const periods = MONTHS.map((_, i) => `${year}-${pad(i + 1)}`).filter((p) => p <= current);
          const doneCount = periods.filter((p) => completed.has(p)).length;
          return (
            <div key={year} className="year-row">
              <button
                type="button"
                className="year-label"
                onClick={() => toggle(periods)}
                title={`Select every month of ${year}`}
                aria-pressed={periods.length > 0 && periods.every((p) => selected.has(p))}
              >
                {year}
                <span className="year-count">{doneCount}/12</span>
              </button>
              <div className="month-cells">
                {MONTHS.map((label, i) => {
                  const p = `${year}-${pad(i + 1)}`;
                  const future = p > current;
                  const done = completed.has(p);
                  const isSelected = selected.has(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={future}
                      className={`month-cell ${done ? 'done' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggle([p])}
                      aria-pressed={isSelected}
                      title={`${fmtMonth(p)}${done ? ' · completed' : ''}`}
                    >
                      {done && <Icon.Check size={11} />}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <button type="button" className="text-btn earlier-years" onClick={() => setExtraYears((n) => n + 1)}>
          Show {years[years.length - 1] - 1}
        </button>
      </div>

      <div className="card-actions">
        {selected.size > 0 ? (
          <div className="selection-bar">
            <span className="bulk-text">
              {selected.size} month{selected.size === 1 ? '' : 's'} selected
            </span>
            <Button size="sm" variant="primary" icon={<Icon.Check size={13} />} disabled={!selectedOpen.length} loading={busy === 'mark'} onClick={() => act('mark')}>
              Mark completed{selectedOpen.length ? ` (${selectedOpen.length})` : ''}
            </Button>
            <Button size="sm" variant="secondary" className="btn-danger-ghost" icon={<Icon.Trash size={13} />} disabled={!selectedDone.length} loading={busy === 'unmark'} onClick={() => act('unmark')}>
              Remove{selectedDone.length ? ` (${selectedDone.length})` : ''}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        ) : (
          <div className="range-form">
            <span className="field-label">Mark a date range completed</span>
            <div className="range-picker">
              <MonthRangePicker
                start={rangeStart}
                end={rangeEnd}
                onChange={(s, e) => {
                  setRangeStart(s);
                  setRangeEnd(e);
                }}
                marked={country.completedMonths}
                markedLabel="Already completed"
              />
            </div>
            <Button size="sm" variant="secondary" icon={<Icon.Plus size={13} />} disabled={!rangeStart} loading={busy === 'range'} onClick={() => act('range')}>
              Mark completed
            </Button>
            <span className="field-help">Or click months (or a year) above to select them.</span>
          </div>
        )}
      </div>
    </section>
  );
}

export function DashboardView() {
  const { countries } = useApp();

  if (!countries) {
    return (
      <>
        <Skeleton height={56} />
        <section className="panel glass">
          <Skeleton height={180} />
        </section>
      </>
    );
  }
  if (!countries.length) return <p className="empty">No countries yet.</p>;

  return (
    <>
      <LatestStrip countries={countries} />
      {countries.map((c, i) => (
        <CountryCard key={c.code} country={c} index={i} />
      ))}
    </>
  );
}
