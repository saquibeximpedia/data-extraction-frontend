'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { useApp } from '@/lib/store';
import type { Country } from '@/lib/types';
import { plural } from '@/lib/format';
import { monthState, type MonthState } from '@/lib/months';
import { MonthGrid, STATE_LABEL } from './MonthGrid';
import { Button, Icon } from './ui';

/** Each click moves a month to the next status, round and round */
const NEXT: Record<MonthState, MonthState> = { none: 'extracting', extracting: 'completed', completed: 'none' };
const ORDER: MonthState[] = ['completed', 'extracting', 'none'];

/**
 * Edit mode of a country's months: click a month to cycle it through not done → extracting →
 * completed. Nothing is saved until "Save"; changed months are outlined until then.
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
      <p className="editor-help">
        Click a month to change it: <span className="cycle-chip state-none">Not done</span>
        <Icon.ArrowRight size={12} />
        <span className="cycle-chip state-extracting">Extracting</span>
        <Icon.ArrowRight size={12} />
        <span className="cycle-chip state-completed">Completed</span>
      </p>

      <MonthGrid country={country} years={years} edit={{ staged, onCycle: cycle }} />

      <div className={`editor-foot ${changes.length ? 'dirty' : ''}`}>
        <span className="editor-summary">
          {changes.length ? (
            <>
              <b>{plural(changes.length, 'change')}</b>
              {summary.map((s) => (
                <span key={s.state} className="summary-chip">
                  <i className={`legend-swatch state-${s.state}`} /> {s.n} {STATE_LABEL[s.state].toLowerCase()}
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
