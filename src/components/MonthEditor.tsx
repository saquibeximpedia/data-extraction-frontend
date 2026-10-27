'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { useApp } from '@/lib/store';
import type { Country } from '@/lib/types';
import { plural } from '@/lib/format';
import { monthState, type MonthState } from '@/lib/months';
import { MonthGrid, STATE_LABEL } from './MonthGrid';
import { Button, Dock, Icon } from './ui';

/** Each click moves a month to the next status, round and round */
const NEXT: Record<MonthState, MonthState> = { none: 'extracting', extracting: 'completed', completed: 'none' };
const ORDER: MonthState[] = ['completed', 'extracting', 'none'];

/**
 * Edit mode of a country's months: click a month to cycle it through not done → extracting →
 * completed (each month's tooltip says its status). A dock at the bottom of the window stays up while
 * editing: Save keeps the changes, Cancel drops them.
 * Changed months are marked until then.
 */
export function MonthEditor({ country, years, onDone }: { country: Country; years: number[]; onDone: () => void }) {
  const { putCountry } = useApp();
  const { busy: saving, run } = useAction();
  const [staged, setStaged] = useState<Map<string, MonthState>>(new Map());

  // A month cycled back to its saved status is no longer a change
  const cycle = (period: string) =>
    setStaged((prev) => {
      const next = new Map(prev);
      const to = NEXT[prev.get(period) ?? monthState(country, period)];
      if (to === monthState(country, period)) next.delete(period);
      else next.set(period, to);
      return next;
    });

  const changes = [...staged].sort(([a], [b]) => a.localeCompare(b));
  const dirty = changes.length > 0;
  const summary = ORDER.map((s) => ({ state: s, n: changes.filter(([, v]) => v === s).length })).filter((s) => s.n > 0);

  function save() {
    const body = changes.map(([period, s]) => ({ period, status: s === 'none' ? null : s }));
    run(() => api.setMonths(country.code, body), (r) => `${country.name}: ${plural(r.changed, 'month')} changed`, (r) => {
      putCountry(r.country);
      setStaged(new Map());
      onDone();
    });
  }

  return (
    <div className="month-editor">
      <MonthGrid country={country} years={years} edit={{ staged, onCycle: cycle }} />

      <Dock open>
        <span className="editor-summary">
          {dirty ? (
            <>
              <b>{plural(changes.length, 'change')}</b>
              {summary.map((s) => (
                <span key={s.state} className="summary-chip">
                  <i className={`legend-swatch state-${s.state}`} /> {s.n} {STATE_LABEL[s.state].toLowerCase()}
                </span>
              ))}
            </>
          ) : (
            'Editing months · no changes yet'
          )}
        </span>
        <Button size="sm" variant="ghost" disabled={saving} onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" icon={<Icon.Check size={13} />} loading={saving} disabled={!dirty} onClick={save}>
          Save changes
        </Button>
      </Dock>
    </div>
  );
}
