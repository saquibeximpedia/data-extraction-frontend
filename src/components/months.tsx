import type { MonthState } from '@/lib/months';

export const STATE_LABEL: Record<MonthState, string> = { completed: 'Completed', extracting: 'Extracting', none: 'Not done' };

/** What each month colour means */
export function MonthLegend() {
  return (
    <div className="month-legend">
      {(['completed', 'extracting', 'none'] as const).map((s) => (
        <span key={s}>
          <i className={`legend-swatch state-${s}`} /> {STATE_LABEL[s]}
        </span>
      ))}
    </div>
  );
}
