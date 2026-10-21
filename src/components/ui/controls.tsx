'use client';

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
