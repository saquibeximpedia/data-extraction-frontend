export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red';

export function Badge({ tone = 'neutral', live, children }: { tone?: Tone; live?: boolean; children: React.ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      {live && <span className="dot dot-live" />}
      {children}
    </span>
  );
}
