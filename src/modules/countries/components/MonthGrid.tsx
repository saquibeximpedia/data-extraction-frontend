'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetMonths } from '@/components/month-actions';
import { STATE_LABEL } from '@/components/months';
import { Button, ContextMenu, Dock, Icon, type MenuItem } from '@/components/ui';
import { fmtMonth, fmtRange, plural } from '@/lib/format';
import { MONTH_LABELS, monthState, nowPeriod, yearPeriods, type MonthState } from '@/lib/months';
import type { Country } from '@/lib/types';

const STATES: MonthState[] = ['completed', 'extracting', 'none'];

/**
 * A country's months, one row per year: completed months are green, extracting ones amber.
 * Click a month to select it, Ctrl/⌘+click to add or remove one, Shift+click for a range, or click
 * a year to take all of it. Right-click opens the status menu for the selection; while months are
 * selected a bar at the bottom offers the same (for touch screens). Each change saves at once,
 * with Undo in its toast.
 */
export function MonthGrid({ country, years }: { country: Country; years: number[] }) {
  const current = nowPeriod();
  const { setMonths } = useSetMonths();
  // The status being saved: only its button shows the spinner
  const [applying, setApplying] = useState<MonthState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // The last month clicked, where a Shift+click range starts
  const [anchor, setAnchor] = useState<string | null>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenuAt(null), []);

  // Months that can be set, oldest first (future months can't)
  const all = years
    .flatMap(yearPeriods)
    .filter((p) => p <= current)
    .sort();
  const periods = all.filter((p) => selected.has(p));
  const states = new Set(periods.map((p) => monthState(country, p)));

  const clear = () => {
    setSelected(new Set());
    setAnchor(null);
  };

  // Escape, or a click anywhere but the months, the bottom bar or the status menu, unselects
  useEffect(() => {
    if (!selected.size) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !menuAt && clear();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (gridRef.current?.contains(target) || dockRef.current?.contains(target) || target.closest?.('[role=menu]')) return;
      clear();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [selected.size, menuAt]);

  function pick(period: string, e: React.MouseEvent) {
    if (e.shiftKey && anchor) {
      const [from, to] = [anchor, period].sort();
      const range = all.filter((p) => p >= from && p <= to);
      setSelected((prev) => new Set([...(e.ctrlKey || e.metaKey ? prev : []), ...range]));
      return;
    }
    setAnchor(period);
    setSelected((prev) => {
      if (e.ctrlKey || e.metaKey) {
        const next = new Set(prev);
        next.has(period) ? next.delete(period) : next.add(period);
        return next;
      }
      // Clicking the only selected month again unselects it
      return prev.size === 1 && prev.has(period) ? new Set() : new Set([period]);
    });
  }

  function pickYear(year: number, e: React.MouseEvent) {
    const months = yearPeriods(year).filter((p) => p <= current);
    setSelected((prev) => {
      if (!(e.ctrlKey || e.metaKey)) return new Set(months);
      const allIn = months.every((p) => prev.has(p));
      const next = new Set(prev);
      for (const p of months) allIn ? next.delete(p) : next.add(p);
      return next;
    });
  }

  function openMenu(period: string, e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();
    // Right-clicking outside the selection acts on that month alone
    if (!selected.has(period)) {
      setSelected(new Set([period]));
      setAnchor(period);
    }
    // The keyboard's menu key reports no pointer position: open by the month instead
    const r = e.currentTarget.getBoundingClientRect();
    setMenuAt(e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : { x: r.left, y: r.bottom + 4 });
  }

  async function apply(state: MonthState) {
    setMenuAt(null);
    // Only months whose status changes (and whose Undo has something to restore)
    const changing = periods.filter((p) => monthState(country, p) !== state);
    if (!changing.length) return clear();
    setApplying(state);
    const saved = await setMonths(country, changing, state === 'none' ? null : state);
    setApplying(null);
    if (saved) clear();
  }

  // The one status every selected month has, ticked in the menu
  const shared = states.size === 1 ? [...states][0] : null;
  const items: MenuItem[] = STATES.map((s) => ({
    label: `Mark ${STATE_LABEL[s].toLowerCase()}`,
    icon: shared === s ? <Icon.Check size={14} /> : <i className={`legend-swatch state-${s}`} />,
    active: shared === s,
    onSelect: () => apply(s),
  }));

  return (
    <>
      <div ref={gridRef} className="year-grid selectable" role="group" aria-label={`${country.name} months`}>
        {years.map((year) => {
          const yearMonths = yearPeriods(year).filter((p) => p <= current);
          const done = yearMonths.filter((p) => monthState(country, p) === 'completed').length;
          return (
            <div key={year} className="year-row">
              <button type="button" className="year-label" title={`Select every month of ${year}`} onClick={(e) => pickYear(year, e)}>
                <span>{year}</span>
                <span className="year-count">
                  {done}/{yearMonths.length}
                </span>
              </button>
              <div className="month-cells">
                {yearPeriods(year).map((p, i) => {
                  const state = monthState(country, p);
                  const future = p > current;
                  const isSelected = selected.has(p);
                  const title = future ? `${fmtMonth(p)} · not started yet` : `${fmtMonth(p)} · ${STATE_LABEL[state]}`;
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`month-cell state-${state} ${future ? 'future' : ''} ${isSelected ? 'selected' : ''}`}
                      title={title}
                      aria-label={title}
                      aria-pressed={isSelected}
                      disabled={future}
                      onClick={(e) => pick(p, e)}
                      onContextMenu={(e) => openMenu(p, e)}
                    >
                      {MONTH_LABELS[i]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ContextMenu at={menuAt} onClose={closeMenu} items={items} label="Set month status" header={`${plural(periods.length, 'month')} · ${fmtRange(periods)}`} />

      <Dock open={selected.size > 0} innerRef={dockRef}>
        <span className="bulk-text">
          <b>{plural(periods.length, 'month')}</b> · {fmtRange(periods)}
        </span>
        {STATES.map((s) => (
          <Button key={s} size="sm" variant="secondary" loading={applying === s} disabled={Boolean(applying) || shared === s} onClick={() => apply(s)}>
            <i className={`legend-swatch state-${s}`} /> {STATE_LABEL[s]}
          </Button>
        ))}
        <Button variant="ghost" size="sm" iconOnly aria-label="Clear selection" icon={<Icon.X size={14} />} onClick={clear} />
      </Dock>
    </>
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
