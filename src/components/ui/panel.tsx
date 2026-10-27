import Link from 'next/link';
import type { Tone } from './badge';

/** Staggers a section's entrance animation (see .reveal) */
export const revealStyle = (i?: number) => (i === undefined ? undefined : ({ '--i': i } as React.CSSProperties));

/**
 * A card with an optional head: title, description, an icon before them and actions on
 * the right. `flush` drops the padding for edge-to-edge tables.
 */
export function Panel({
  title,
  desc,
  icon,
  actions,
  i,
  flush,
  id,
  className = '',
  children,
}: {
  title?: React.ReactNode;
  desc?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  i?: number;
  flush?: boolean;
  id?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className={`panel reveal ${flush ? 'panel-flush' : ''} ${className}`} style={revealStyle(i)}>
      {(title || actions) && (
        <div className={`panel-head ${flush ? 'padded' : ''}`}>
          <div className="panel-head-text">
            {icon}
            <div>
              {title && <h2 className="panel-title">{title}</h2>}
              {desc && <p className="panel-desc">{desc}</p>}
            </div>
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Centered message for an empty list or a missing item */
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}

export interface StatTile {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'green' | 'amber' | 'red' | 'blue' | '';
  /** Makes the tile a link */
  href?: string;
}

/** A row of headline numbers. `inset` draws them as wells inside a panel instead of separate cards. */
export function StatTiles({ tiles, i, inset }: { tiles: StatTile[]; i?: number; inset?: boolean }) {
  return (
    <section className={`stat-row ${inset ? 'inset' : 'reveal'}`} style={inset ? undefined : revealStyle(i)}>
      {tiles.map((t) => {
        const body = (
          <>
            <span className="stat-label">{t.label}</span>
            <span className="stat-value">{t.value}</span>
            {(t.sub !== undefined || !inset) && <span className="stat-sub">{t.sub || ' '}</span>}
          </>
        );
        const className = `stat-tile ${inset ? 'stat-inset' : ''} ${t.tone ? `stat-${t.tone}` : ''} ${t.href ? 'stat-link' : ''}`;
        return t.href ? (
          <Link key={t.label} href={t.href} className={className}>
            {body}
          </Link>
        ) : (
          <div key={t.label} className={className}>
            {body}
          </div>
        );
      })}
    </section>
  );
}

/** A thin progress bar, 0–100 */
export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="stats-progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="stats-progress-bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A small coloured status dot; `live` makes it pulse */
export function StatusDot({ tone, live }: { tone?: Tone; live?: boolean }) {
  const color = tone && tone !== 'neutral' ? `dot-${tone}` : '';
  return <span className={`dot ${color} ${live ? 'dot-live' : ''}`} aria-hidden="true" />;
}
