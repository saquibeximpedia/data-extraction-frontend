/**
 * A highlighted card saying what to do next: an eyebrow (`label`), the step, optional help or
 * progress, and its buttons. `kind` sets its colour (review, running, due or done).
 */
export function StepCard({
  kind,
  label,
  title,
  children,
  actions,
  className = '',
  style,
}: {
  kind: 'review' | 'running' | 'due' | 'done';
  label: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={`next-step next-${kind} ${className}`} style={style} aria-label="Next step">
      <div className="next-step-text">
        <span className="next-step-eyebrow">{label}</span>
        <span className="next-step-title">{title}</span>
        {children}
      </div>
      {actions && <div className="next-step-actions">{actions}</div>}
    </section>
  );
}
