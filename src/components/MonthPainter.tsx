'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { useApp } from '@/lib/store';
import type { Country } from '@/lib/types';
import { fmtRange, plural } from '@/lib/format';
import { monthState, nowPeriod, periodRange, type MonthState } from '@/lib/months';
import { MonthGrid } from './MonthGrid';
import { Button, Icon, MonthRangePicker } from './ui';

const BRUSHES: { value: MonthState; label: string; hint: string }[] = [
  { value: 'completed', label: 'Completed', hint: 'Extracted and checked' },
  { value: 'extracting', label: 'Extracting', hint: 'Started, not checked yet' },
  { value: 'none', label: 'Not done', hint: 'Clears the month' },
];

/**
 * Edit mode of a country's months. Pick a status (the brush), then click or drag across months,
 * click a year to paint all of it, or shift-click to paint everything since the last month.
 * Nothing is saved until "Save"; changed months are outlined until then.
 */
export function MonthPainter({ country, years, onDone }: { country: Country; years: number[]; onDone: () => void }) {
  const { putCountry } = useApp();
  const { busy: saving, run } = useAction();
  const [brush, setBrush] = useState<MonthState>('completed');
  const [staged, setStaged] = useState<Map<string, MonthState>>(new Map());
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const painting = useRef(false);
  const anchor = useRef<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  /** Paints months with the brush; a month painted back to its saved status is no longer a change */
  const paint = useCallback(
    (periods: string[]) => {
      const current = nowPeriod();
      setStaged((prev) => {
        const next = new Map(prev);
        for (const p of periods) {
          if (p > current) continue;
          if (monthState(country, p) === brush) next.delete(p);
          else next.set(p, brush);
        }
        return next;
      });
    },
    [brush, country]
  );

  // Dragging: follow the pointer over cells (elementFromPoint also works for touch)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!painting.current) return;
      const cell = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-period]');
      if (cell && !cell.hasAttribute('disabled') && gridRef.current?.contains(cell)) paint([cell.dataset.period!]);
    };
    const end = () => (painting.current = false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [paint]);

  const onPress = (period: string, e: React.PointerEvent | React.MouseEvent) => {
    if ('button' in e && e.button !== 0) return;
    e.preventDefault();
    if (e.shiftKey && anchor.current) paint(periodRange(anchor.current, period));
    else paint([period]);
    anchor.current = period;
    if (e.type === 'pointerdown') painting.current = true;
  };

  const changes = [...staged].sort(([a], [b]) => a.localeCompare(b));
  const count = (s: MonthState) => changes.filter(([, v]) => v === s).length;
  const summary = BRUSHES.map((b) => ({ ...b, n: count(b.value) })).filter((b) => b.n > 0);

  function save() {
    const body = changes.map(([period, s]) => ({ period, status: s === 'none' ? null : s }));
    run(() => api.setMonths(country.code, body), (r) => `${country.name}: ${plural(r.changed, 'month')} changed`, (r) => {
      putCountry(r.country);
      setStaged(new Map());
      onDone();
    });
  }

  return (
    <div className="painter">
      <div className="painter-bar">
        <div className="brush-group" role="radiogroup" aria-label="Status to paint">
          <span className="brush-title">
            <Icon.Brush size={14} /> Paint as
          </span>
          {BRUSHES.map((b) => (
            <button key={b.value} type="button" role="radio" aria-checked={brush === b.value} className={`brush brush-${b.value}`} onClick={() => setBrush(b.value)} title={b.hint}>
              <i className={`legend-swatch state-${b.value}`} />
              {b.label}
            </button>
          ))}
        </div>
        <p className="painter-help">Click or drag across months · click a year for all of it · shift-click to fill a span</p>
      </div>

      <div ref={gridRef}>
        <MonthGrid country={country} years={years} paint={{ staged, onPress, onYear: paint }} />
      </div>

      <div className="painter-range">
        <span className="field-label">Or a date range</span>
        <div className="range-picker">
          <MonthRangePicker
            start={rangeStart}
            end={rangeEnd}
            onChange={(s, e) => {
              setRangeStart(s);
              setRangeEnd(e);
            }}
            marked={country.completedMonths}
            markedLabel="Completed"
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<Icon.Brush size={13} />}
          disabled={!rangeStart}
          onClick={() => {
            paint(periodRange(rangeStart, rangeEnd));
            setRangeStart('');
            setRangeEnd('');
          }}
        >
          Paint {rangeStart ? fmtRange([rangeStart, rangeEnd]) : 'range'} as {BRUSHES.find((b) => b.value === brush)!.label.toLowerCase()}
        </Button>
      </div>

      <div className={`painter-foot ${changes.length ? 'dirty' : ''}`}>
        <span className="painter-summary">
          {changes.length ? (
            <>
              <b>{plural(changes.length, 'change')}</b>
              {summary.map((s) => (
                <span key={s.value} className="summary-chip">
                  <i className={`legend-swatch state-${s.value}`} /> {s.n} {s.label.toLowerCase()}
                </span>
              ))}
            </>
          ) : (
            'No changes yet'
          )}
        </span>
        <div className="inline-form">
          <Button size="sm" variant="ghost" onClick={() => (changes.length ? setStaged(new Map()) : onDone())}>
            {changes.length ? 'Discard' : 'Done'}
          </Button>
          <Button size="sm" variant="primary" icon={<Icon.Check size={13} />} disabled={!changes.length} loading={saving} onClick={save}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
