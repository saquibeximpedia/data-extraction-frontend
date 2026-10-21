'use client';

import { useApp } from '@/lib/store';
import { fmtRelative } from '@/lib/format';
import { useCountUp } from '@/lib/hooks';
import { Badge, Skeleton } from './ui';

function Stat({ label, value, note, tone }: { label: string; value?: number; note: string; tone?: 'green' | 'amber' | 'red' }) {
  const shown = useCountUp(value);
  return (
    <div className="stat">
      <div className="stat-label">
        {tone && <span className={`dot dot-${tone}`} />}
        {label}
      </div>
      <div className="stat-value">{shown === undefined ? <Skeleton width={64} height={34} /> : shown.toLocaleString()}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

const RUN_TONE = { COMPLETED: 'green', RUNNING: 'blue', FAILED: 'red', INTERRUPTED: 'amber', STOPPED: 'amber' } as const;

/** Totals across all countries, in one strip of divided cells */
export function StatsRow() {
  const { health } = useApp();
  const s = health?.summary.byStatus;
  const last = health?.summary.latestRun;
  return (
    <section className="stats glass reveal" style={{ '--i': 2 } as React.CSSProperties}>
      <Stat label="Months done" value={s?.COMPLETED} note="Tasks with data saved" tone="green" />
      <Stat label="Waiting on source" value={s?.NO_DATA} note="Not published yet, retried daily" tone="amber" />
      <Stat label="Failed" value={s?.FAILED} note="Errors, retried automatically" tone="red" />
      <div className="stat">
        <div className="stat-label">Last run</div>
        <div className="stat-value stat-value-sm">
          {!health ? (
            <Skeleton width={90} height={24} />
          ) : last ? (
            <Badge tone={RUN_TONE[last.status]} live={last.status === 'RUNNING'}>
              {last.status.charAt(0) + last.status.slice(1).toLowerCase()}
            </Badge>
          ) : (
            <span className="faint">None yet</span>
          )}
        </div>
        <div className="stat-note">{last ? fmtRelative(last.startedAt) : 'Start one below'}</div>
      </div>
    </section>
  );
}
