'use client';

import { RunProgress, useProgress } from '@/components/run-progress';
import { Badge, Button, Icon } from '@/components/ui';
import { capitalize, fmtMs, fmtNumber } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { isRunning, RUN_TONE } from '@/lib/runs';
import type { Run } from '@/lib/types';
import { extractor } from '@/modules/service/client';
import { useApp } from '@/modules/service/store';

// Pieces of an extraction shown in the list and on its page: status, outcome, elapsed time, stop

export function RunStatusBadge({ run }: { run: Run }) {
  const { serviceLive } = useApp();
  // The database says running, but the service that runs it can't be reached to confirm
  if (isRunning(run) && !serviceLive) {
    return (
      <Badge tone="amber" dot>
        Running? Service offline
      </Badge>
    );
  }
  return (
    <Badge tone={RUN_TONE[run.status]} dot live={isRunning(run)}>
      {capitalize(run.status)}
    </Badge>
  );
}

/** A finished run as a stacked bar: each segment is a share of its planned requests */
export function RunOutcome({ run }: { run: Run }) {
  const s = run.stats;
  const parts = [
    { key: 'ok', n: s.completed, label: 'with data' },
    { key: 'none', n: s.noData, label: '0 records' },
    { key: 'err', n: s.failed, label: 'failed' },
    { key: 'skip', n: s.skipped, label: 'skipped' },
  ].filter((p) => p.n > 0);
  const finished = parts.reduce((sum, p) => sum + p.n, 0);
  const total = Math.max(s.planned ?? 0, finished, 1);

  return (
    <div className="outcome">
      <div className="outcome-bar" title={`${fmtNumber(finished)} of ${fmtNumber((s.planned ?? finished))} requests`}>
        {parts.map((p) => (
          <span key={p.key} className={`seg seg-${p.key}`} style={{ width: `${(p.n / total) * 100}%` }} />
        ))}
      </div>
      <div className="outcome-text">
        {parts.length === 0
          ? 'Nothing to do'
          : parts.map((p, i) => (
              <span key={p.key}>
                {i > 0 && ' · '}
                <b>{fmtNumber(p.n)}</b> {p.label}
              </span>
            ))}
      </div>
    </div>
  );
}

/** Running: its progress; otherwise its outcome */
export const RunBar = ({ run }: { run: Run }) => (isRunning(run) ? <RunProgress run={run} /> : <RunOutcome run={run} />);

/** A running extraction's elapsed time, ticking every second */
export function Elapsed({ run }: { run: Run }) {
  return <>{fmtMs(useProgress(run).elapsedMs)}</>;
}

export function StopButton({ run }: { run: Run }) {
  const { refreshLiveRuns, serviceLive } = useApp();
  const { busy, run: act } = useAction();
  if (!serviceLive) return null;
  return (
    <Button
      size="sm"
      variant="secondary"
      className="btn-stop"
      loading={busy}
      icon={<Icon.Stop size={12} />}
      onClick={(e) => {
        // Inside clickable rows and cards
        e.preventDefault();
        e.stopPropagation();
        act(() => extractor.stopRun(run.id), 'Extraction stopping: months that returned rows keep their files', refreshLiveRuns, 'Could not stop the extraction');
      }}
    >
      Stop
    </Button>
  );
}

/** Highlights rows and saved files in a log line */
export function formatLogMessage(msg: string) {
  if (msg.includes(': 0 records')) return <span className="log-dim">{msg}</span>;
  if (msg.includes('Saved CSV file') || msg.includes('Extraction completed')) return <span className="log-success">{msg}</span>;
  if (msg.includes('EXPORT:') || msg.includes('IMPORT:')) {
    return (
      <span>
        {msg.split(/(EXPORT: \d+ rows|IMPORT: \d+ rows)/g).map((part, i) =>
          /(EXPORT|IMPORT): \d+ rows/.test(part) ? (
            <span key={i} className="log-success">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  }
  return <span>{msg}</span>;
}
