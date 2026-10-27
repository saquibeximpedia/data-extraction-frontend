'use client';

import { useEffect, useState } from 'react';
import { fmtMs, fmtNumber } from '@/lib/format';
import { isRunning } from '@/lib/runs';
import type { Run } from '@/lib/types';
import { ProgressBar } from './ui';

/** Progress of a run; a running one re-renders every second so elapsed time and the estimate tick */
export function useProgress(run: Run) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isRunning(run)) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [run.status]);

  const s = run.stats;
  const finished = s.completed + s.noData + s.failed + s.skipped;
  const total = Math.max(s.planned ?? 0, finished);
  const elapsedMs = Math.max(1000, (run.finishedAt ? new Date(run.finishedAt).getTime() : now) - new Date(run.startedAt).getTime());
  const perSec = (s.completed + s.noData + s.failed) / (elapsedMs / 1000);
  const remaining = Math.max(0, total - finished);
  return {
    finished,
    total,
    remaining,
    elapsedMs,
    perMin: perSec * 60,
    pct: total > 0 ? Math.min(100, Math.round((finished / total) * 100)) : 0,
    eta: finished >= 3 && perSec > 0 && remaining > 0 ? `~${fmtMs((remaining / perSec) * 1000)}` : '',
  };
}

/** A running run's bar with "45% · 120 / 260 requests · ~3m left" */
export function RunProgress({ run }: { run: Run }) {
  const p = useProgress(run);
  return (
    <div className="outcome">
      <ProgressBar pct={p.pct} />
      <div className="outcome-text">
        <b>{p.pct}%</b> · {fmtNumber(p.finished)} / {fmtNumber(p.total)} requests
        {p.eta ? ` · ${p.eta} left` : ''}
      </div>
    </div>
  );
}
