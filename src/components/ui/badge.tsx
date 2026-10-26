export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red';

/**
 * A short status or label in a soft pill. `dot` leads with a dot in the tone's colour (for
 * statuses); `live` makes that dot pulse (something is happening right now).
 */
export function Badge({ tone = 'neutral', dot, live, title, children }: { tone?: Tone; dot?: boolean; live?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {(dot || live) && <span className={`badge-dot ${live ? 'dot-live' : ''}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
