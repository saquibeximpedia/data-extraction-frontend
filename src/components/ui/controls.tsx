'use client';

import { Icon } from './icons';

/** A search box with a clear button */
export function SearchInput({ value, onChange, placeholder, className = '' }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={`search ${className}`}>
      <Icon.Search size={15} />
      <input type="search" className="search-input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
      {value && (
        <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <Icon.X size={12} />
        </button>
      )}
    </label>
  );
}

/** Two or three mutually exclusive options with a sliding thumb */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  label?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      <span className="segmented-thumb" style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${index * 100}%)` }} />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, htmlFor, aside, children }: { label: string; htmlFor?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="field">
      <div className="field-head">
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** A whole-number field with an optional unit after it; empty means "use the default" (shown as the placeholder) */
export function NumberInput({
  id,
  value,
  onChange,
  placeholder,
  unit,
  min,
  max,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  unit?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div className="number-input">
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="control"
        value={value}
        min={min}
        max={max}
        step={1}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
      />
      {unit && <span className="number-unit">{unit}</span>}
    </div>
  );
}
