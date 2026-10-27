'use client';

import { useEffect, useState } from 'react';
import { MonthLegend } from '@/components/months';
import { Button, Icon, Menu, Panel } from '@/components/ui';
import { addableYears, yearsFor } from '@/lib/months';
import type { Country } from '@/lib/types';
import { MonthEditor } from './MonthEditor';
import { MonthGrid } from './MonthGrid';

/** Opens the months in edit mode, e.g. from the next step's "Change only some" */
const EDIT_HASH = '#edit-months';

/** Every year of a country's months; Edit months paints them, and earlier years can be shown */
export function CountryMonths({ country, i = 3 }: { country: Country; i?: number }) {
  const [addedYears, setAddedYears] = useState<number[]>([]);
  const [editing, setEditing] = useState(false);
  const years = yearsFor(country, addedYears);
  const addable = addableYears(country, years);

  useEffect(() => {
    const open = () => {
      if (window.location.hash !== EDIT_HASH) return;
      setEditing(true);
      history.replaceState(null, '', window.location.pathname + window.location.search);
      document.getElementById('months')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);

  return (
    <Panel
      id="months"
      i={i}
      className={editing ? 'panel-editing' : ''}
      title="Months"
      actions={
        // Stays while editing (disabled) so the card doesn't shift
        <Button size="sm" variant="secondary" icon={<Icon.Pencil size={13} />} disabled={editing} onClick={() => setEditing(true)}>
          {editing ? 'Editing' : 'Edit months'}
        </Button>
      }
    >
      {editing ? <MonthEditor key={country.code} country={country} years={years} onDone={() => setEditing(false)} /> : <MonthGrid country={country} years={years} />}
      <div className="months-foot">
        <MonthLegend />
        {addable.length > 0 && (
          <Menu
            label="Show another year"
            width={160}
            trigger={{
              className: 'text-btn',
              content: (
                <>
                  <Icon.Plus size={12} /> Show another year
                </>
              ),
            }}
            items={addable.map((y) => ({ label: String(y), onSelect: () => setAddedYears((prev) => [...prev, y]) }))}
          />
        )}
      </div>
    </Panel>
  );
}
