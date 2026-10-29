'use client';

import { useState } from 'react';
import { MonthLegend } from '@/components/months';
import { ConfirmModal, Field, Icon, Panel } from '@/components/ui';
import { yearProblem, yearsFor } from '@/lib/months';
import type { Country } from '@/lib/types';
import { MonthGrid } from './MonthGrid';

/** Shows an earlier year: the year is typed in a dialog */
function AddYear({ country, shown, onAdd }: { country: Country; shown: number[]; onAdd: (year: number) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const problem = yearProblem(country, shown, input);
  const close = () => {
    setOpen(false);
    setInput('');
  };
  const add = () => {
    if (problem) return;
    onAdd(Number(input));
    close();
  };

  return (
    <>
      <button type="button" className="text-btn" onClick={() => setOpen(true)}>
        <Icon.Plus size={12} /> Show another year
      </button>
      <ConfirmModal
        open={open}
        onClose={close}
        onConfirm={add}
        title="Show another year"
        confirmVariant="primary"
        confirmLabel="Show year"
        confirmDisabled={Boolean(problem)}
        description={
          <div className="modal-form">
            <Field label="Year" htmlFor="add-year">
              <input
                id="add-year"
                className="control"
                inputMode="numeric"
                maxLength={4}
                placeholder={String(Math.min(...shown) - 1)}
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              {input && problem && <p className="field-help">{problem}</p>}
            </Field>
          </div>
        }
      />
    </>
  );
}

/** Every year of a country's months: right-click a month (or a Ctrl+click selection) to set its status */
export function CountryMonths({ country, i = 3 }: { country: Country; i?: number }) {
  const [addedYears, setAddedYears] = useState<number[]>([]);
  const years = yearsFor(country, addedYears);

  return (
    <Panel id="months" i={i} title="Months" desc="Right-click a month to set its status. Ctrl+click (⌘ on Mac) or Shift+click to select several.">
      <MonthGrid country={country} years={years} />
      <div className="months-foot">
        <MonthLegend />
        <AddYear country={country} shown={years} onAdd={(y) => setAddedYears((prev) => [...prev, y])} />
      </div>
    </Panel>
  );
}
