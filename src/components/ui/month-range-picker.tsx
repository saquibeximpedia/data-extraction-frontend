'use client';

import { useEffect, useState } from 'react';
import { usePopover, PopoverPanel } from './popover';
import { Icon } from './icons';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const key = (year: number, monthIndex: number) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
const label = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export interface MonthPreset {
  label: string;
  start: string;
  end: string;
}

/**
 * Pick a "YYYY-MM" range on a year grid: first click sets the start, second click the end.
 * With `single`, one click picks one month (start = end).
 * `marked` months get a dot, explained by `markedLabel` (e.g. months already extracted).
 */
export function MonthRangePicker({
  id,
  start,
  end,
  onChange,
  presets = [],
  marked = [],
  markedLabel = 'Marked',
  single = false,
}: {
  id?: string;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  presets?: MonthPreset[];
  marked?: string[];
  markedLabel?: string;
  single?: boolean;
}) {
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();
  const [year, setYear] = useState(() => Number((end || start || '').slice(0, 4)) || new Date().getFullYear());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAnchor(null);
      setYear(Number((end || start).slice(0, 4)) || new Date().getFullYear());
    }
  }, [open]);

  // While choosing the end, preview the range under the pointer
  const [lo, hi] = anchor ? [anchor, hover ?? anchor].sort() : [start, end];
  const today = key(new Date().getFullYear(), new Date().getMonth());

  function choose(period: string) {
    if (single) {
      onChange(period, period);
      close();
      return;
    }
    if (!anchor) {
      setAnchor(period);
      return;
    }
    const [a, b] = [anchor, period].sort();
    onChange(a, b);
    close();
  }

  const text = !start ? 'Pick months' : start === end ? label(start) : `${label(start)} – ${label(end)}`;

  return (
    <div className="popover-root" ref={rootRef}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="control select-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="control-icon">
          <Icon.Calendar />
        </span>
        <span className="select-value">{text}</span>
        <span className={`select-chevron ${open ? 'open' : ''}`}>
          <Icon.ChevronDown />
        </span>
      </button>

      {open && (
        <PopoverPanel width={320} role="dialog" aria-label={single ? "Choose month" : "Choose month range"}>
          <div className="mp-head">
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
              <Icon.ChevronLeft />
            </button>
            <span className="mp-year">{year}</span>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
              <Icon.ChevronRight />
            </button>
          </div>

          <p className="mp-hint">{single ? 'Pick a month' : anchor ? `From ${label(anchor)} — now pick the last month` : 'Pick the first month'}</p>

          <div className="mp-grid" onMouseLeave={() => setHover(null)}>
            {MONTHS.map((m, i) => {
              const p = key(year, i);
              const inRange = lo && hi && p >= lo && p <= hi;
              const isEdge = p === lo || p === hi;
              return (
                <button
                  key={p}
                  type="button"
                  className={`mp-cell ${inRange ? 'in-range' : ''} ${isEdge ? 'edge' : ''} ${p === today ? 'today' : ''}`}
                  onMouseEnter={() => setHover(p)}
                  onClick={() => choose(p)}
                  aria-pressed={!!inRange}
                >
                  {m}
                  {marked.includes(p) && <span className="mp-mark" />}
                </button>
              );
            })}
          </div>

          {presets.length > 0 && (
            <div className="mp-presets">
              {presets.map((pr) => (
                <button
                  key={pr.label}
                  type="button"
                  className="chip-btn"
                  onClick={() => {
                    onChange(pr.start, pr.end);
                    close();
                  }}
                >
                  {pr.label}
                </button>
              ))}
            </div>
          )}
          {marked.length > 0 && (
            <p className="mp-legend">
              <span className="mp-mark static" /> {markedLabel}
            </p>
          )}
        </PopoverPanel>
      )}
    </div>
  );
}
