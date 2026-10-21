export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red';

export function Badge({ tone = 'neutral', live, children }: { tone?: Tone; live?: boolean; children: React.ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      {live && <span className="dot dot-live" />}
      {children}
    </span>
  );
}

/** Small count pill used in section headers */
export function Count({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`count count-${tone}`}>{children}</span>;
}

export function Dot({ tone = 'neutral', live }: { tone?: Tone; live?: boolean }) {
  return <span className={`dot dot-${tone} ${live ? 'dot-live' : ''}`} />;
}
