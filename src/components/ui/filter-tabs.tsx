'use client';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /** Shown after the label; omitted when undefined */
  count?: number;
}

/** One row of mutually exclusive list filters with their counts, e.g. All · Needs action · Up to date */
export function FilterTabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="filter-tabs" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className="filter-tab" onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="filter-count">{o.count.toLocaleString()}</span>}
        </button>
      ))}
    </div>
  );
}
