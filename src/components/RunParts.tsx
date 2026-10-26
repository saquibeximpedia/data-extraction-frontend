'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, extractor } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Run } from '@/lib/types';
import { capitalize, describePlan, fmtMs, fmtRelative, plural } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { describeRun, fmtRecords, isRunning, RUN_TONE } from '@/lib/runs';
import { Badge, Button, Icon, ProgressBar, StatusDot } from './ui';

// Pieces of an extraction run shown on several pages: status, progress, outcome, stop, files

export function RunStatusBadge({ run }: { run: Run }) {
  const { serviceLive } = useApp();
  // The database says running, but the service that runs it can't be reached to confirm
  if (isRunning(run) && !serviceLive) return <Badge tone="amber">Running? Service offline</Badge>;
  return (
    <Badge tone={RUN_TONE[run.status]} live={isRunning(run)}>
      {capitalize(run.status)}
    </Badge>
  );
}

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
        <b>{p.pct}%</b> · {p.finished.toLocaleString()} / {p.total.toLocaleString()} requests
        {p.eta ? ` · ${p.eta} left` : ''}
      </div>
    </div>
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
      <div className="outcome-bar" title={`${finished.toLocaleString()} of ${(s.planned ?? finished).toLocaleString()} requests`}>
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
                <b>{p.n.toLocaleString()}</b> {p.label}
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
  const { refreshRuns, serviceLive } = useApp();
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
        act(() => extractor.stopRun(run.id), 'Extraction stopping: months that returned rows keep their files', refreshRuns, 'Could not stop the extraction');
      }}
    >
      Stop
    </Button>
  );
}

/** The files a run saved, each a download chip */
export function RunFiles({ files }: { files: string[] }) {
  if (!files.length) return null;
  return (
    <div className="stats-files-section">
      <div className="stats-files-title">
        <Icon.File size={12} /> {plural(files.length, 'file')} saved
      </div>
      <div className="stats-files-list">
        {files.map((file) => (
          <button key={file} type="button" className="stats-file-chip" title={`Download ${file}`} onClick={() => api.download(file)}>
            <Icon.Download size={11} />
            <span className="stats-file-name">{file.split('/').pop()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Compact list of runs (a country's recent ones, or what runs now), each linking to its page */
export function MiniRuns({ runs, country }: { runs: Run[]; country?: string }) {
  return (
    <ul className="mini-runs">
      {runs.map((r) => {
        const plan = country ? r.params?.plans?.find((p) => p.countryCode === country) : undefined;
        return (
          <li key={r.id}>
            <Link href={`/extractions/${r.id}`} className="mini-run">
              <StatusDot tone={RUN_TONE[r.status]} live={isRunning(r)} />
              <span className="mini-run-text">
                <span className="cell-strong">{plan ? describePlan({ ...plan, countryCode: '' }) : describeRun(r)}</span>
                <span className="cell-sub">
                  {fmtRelative(r.startedAt)}
                  {r.stats.records !== undefined ? ` · ${fmtRecords(r)} rows` : ''}
                </span>
              </span>
              <Icon.ChevronRight size={14} />
            </Link>
          </li>
        );
      })}
    </ul>
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
