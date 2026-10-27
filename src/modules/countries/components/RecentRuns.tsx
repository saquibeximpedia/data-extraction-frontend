import Link from 'next/link';
import { Icon, Panel, StatusDot, When } from '@/components/ui';
import { describePlan } from '@/lib/format';
import { describeRun, fmtRecords, isRunning, RUN_TONE } from '@/lib/runs';
import type { Run } from '@/lib/types';

/** A country's latest extractions, each linking to its page */
export function RecentRuns({ code, runs, i = 5 }: { code: string; runs: Run[]; i?: number }) {
  return (
    <Panel
      i={i}
      title="Recent extractions"
      desc={runs.length ? `Last ${runs.length}` : 'None yet'}
      actions={
        <Link href="/extractions" className="link">
          All <Icon.ChevronRight size={14} />
        </Link>
      }
    >
      {runs.length > 0 && (
        <ul className="mini-runs">
          {runs.map((r) => {
            const plan = r.params?.plans?.find((p) => p.countryCode === code);
            return (
              <li key={r.id}>
                <Link href={`/extractions/${r.id}`} className="mini-run">
                  <StatusDot tone={RUN_TONE[r.status]} live={isRunning(r)} />
                  <span className="mini-run-text">
                    <span className="cell-strong">{plan ? describePlan({ ...plan, countryCode: '' }) : describeRun(r)}</span>
                    <span className="cell-sub">
                      <When value={r.startedAt} as="relative" />
                      {r.stats.records !== undefined ? ` · ${fmtRecords(r)} rows` : ''}
                    </span>
                  </span>
                  <Icon.ChevronRight size={14} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
