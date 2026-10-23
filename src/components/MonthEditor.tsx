'use client';

import { useState } from 'react';
import { api, errorText } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Country, MonthStatus } from '@/lib/types';
import { fmtRange, plural } from '@/lib/format';
import { yearsFor } from '@/lib/months';
import { countrySummary } from './CountryView';
import { MonthGrid, MonthLegend } from './MonthGrid';
import { PageHead } from './PageHead';
import { Button, Icon, MonthRangePicker, useToast } from './ui';

type Action = MonthStatus | 'remove' | 'range';

/** Select months (or whole years) and mark them completed or extracting, or remove them */
export function MonthEditor({ country }: { country: Country }) {
  const { putCountry } = useApp();
  const toast = useToast();
  const [extraYears, setExtraYears] = useState(0);
  const years = yearsFor(country, extraYears);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [busy, setBusy] = useState<Action | null>(null);

  const toggle = (periods: string[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = periods.every((p) => next.has(p));
      for (const p of periods) allOn ? next.delete(p) : next.add(p);
      return next;
    });

  const list = [...selected].sort();
  const completed = new Set(country.completedMonths);
  const extracting = new Set(country.extractingMonths);
  const toComplete = list.filter((p) => !completed.has(p));
  const toExtracting = list.filter((p) => !extracting.has(p));
  const toRemove = list.filter((p) => completed.has(p) || extracting.has(p));

  async function act(action: Action) {
    setBusy(action);
    try {
      let result: { country: Country; n: number; done: string };
      if (action === 'remove') {
        const r = await api.unmarkMonths(country.code, toRemove);
        result = { country: r.country, n: r.removed, done: 'removed' };
      } else if (action === 'range') {
        const r = await api.markMonths(country.code, { start: rangeStart, end: rangeEnd });
        result = { country: r.country, n: r.added, done: `marked completed (${fmtRange([rangeStart, rangeEnd])})` };
      } else {
        const r = await api.markMonths(country.code, { periods: action === 'completed' ? toComplete : toExtracting, status: action });
        result = { country: r.country, n: r.added, done: `marked ${action}` };
      }
      putCountry(result.country);
      toast('ok', 'Months saved', `${country.name}: ${plural(result.n, 'month')} ${result.done}`);
      setSelected(new Set());
      setRangeStart('');
      setRangeEnd('');
    } catch (err) {
      toast('err', 'Could not save', errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHead back={{ href: `/countries/${country.code}`, label: country.name }} title={`Edit months · ${country.name}`} sub={countrySummary(country)} />

      <section className="panel glass reveal" style={{ '--i': 1 } as React.CSSProperties}>
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Months</h2>
            <p className="panel-desc">Click months, or a year to select all of it, then choose what to do with them.</p>
          </div>
          <MonthLegend />
        </div>

        <MonthGrid country={country} years={years} selected={selected} onToggle={toggle} />
        <button type="button" className="text-btn earlier-years" onClick={() => setExtraYears((n) => n + 1)}>
          Show {years[years.length - 1] - 1}
        </button>

        <div className="card-actions">
          {selected.size > 0 ? (
            <div className="selection-bar">
              <span className="bulk-text">{plural(selected.size, 'month')} selected</span>
              <Button size="sm" variant="primary" icon={<Icon.Check size={13} />} disabled={!toComplete.length} loading={busy === 'completed'} onClick={() => act('completed')}>
                Mark completed{toComplete.length ? ` (${toComplete.length})` : ''}
              </Button>
              <Button size="sm" variant="secondary" disabled={!toExtracting.length} loading={busy === 'extracting'} onClick={() => act('extracting')}>
                Mark extracting{toExtracting.length ? ` (${toExtracting.length})` : ''}
              </Button>
              <Button size="sm" variant="secondary" className="btn-danger-ghost" icon={<Icon.Trash size={13} />} disabled={!toRemove.length} loading={busy === 'remove'} onClick={() => act('remove')}>
                Remove{toRemove.length ? ` (${toRemove.length})` : ''}
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
            </div>
          )}
        </div>
      </section>
    </>
  );
}
