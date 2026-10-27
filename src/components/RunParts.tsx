'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorText, extractor } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Run } from '@/lib/types';
import { capitalize, describePlan, fmtMonth, fmtMs, fmtRelative, fmtSize, plural } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { describeRun, fmtRecords, isRunning, RUN_TONE } from '@/lib/runs';
import { Badge, Button, FileIcon, Icon, ProgressBar, StatusDot, useToast } from './ui';

// Pieces of an extraction run shown on several pages: status, progress, outcome, stop, files

export function RunStatusBadge({ run }: { run: Run }) {
  const { serviceLive } = useApp();
  // The database says running, but the service that runs it can't be reached to confirm
  if (isRunning(run) && !serviceLive) return (
      <Badge tone="amber" dot>
        Running? Service offline
      </Badge>
    );
  return (
    <Badge tone={RUN_TONE[run.status]} dot live={isRunning(run)}>
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

// {CC}_{YYYY-MM}.csv or {CC}_{YYYY-MM}_part{N}.csv
const RUN_FILE_RE = /^([A-Z]{2,3})_(\d{4}-\d{2})(?:_part(\d+))?\./i;

/**
 * The files a run saved, grouped by country and month (a big month comes in parts): each file
 * with its size from storage and a download, each month and the whole run as one zip. Files
 * deleted since are marked Deleted; each country links to all of its files.
 */
export function RunFiles({ files }: { files: string[] }) {
  const { files: stored, countries } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!files.length) return null;

  const rows = [...files].sort().map((path) => {
    const name = path.split('/').pop() ?? path;
    const m = name.match(RUN_FILE_RE);
    const code = m?.[1].toUpperCase();
    return {
      path,
      name,
      code,
      country: code ? (countries?.find((c) => c.code === code)?.name ?? code) : '',
      period: m?.[2] ?? null,
      part: m?.[3] ? Number(m[3]) : null,
      stored: stored?.find((f) => f.relativePath === path),
    };
  });
  type Row = (typeof rows)[number];
  const isAvailable = (r: Row) => Boolean(r.stored) || stored === null;
  const available = rows.filter(isAvailable);
  const sizeOf = (list: Row[]) => list.reduce((n, r) => n + (r.stored?.sizeBytes ?? 0), 0);
  const total = sizeOf(rows);
  const deleted = rows.length - available.length;
  const codes = [...new Map(rows.filter((r) => r.code).map((r) => [r.code!, r.country])).entries()];
  // One group per country and month, in the order the files sort
  const groups = [...new Map(rows.map((r) => [`${r.country}|${r.period}`, rows.filter((x) => x.country === r.country && x.period === r.period)])).values()];

  async function download(paths: string[], key: string) {
    setBusy(key);
    try {
      if (paths.length === 1) await api.download(paths[0]);
      else await api.downloadZip(paths);
    } catch (err) {
      toast('err', 'Could not download', errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="run-files" aria-label="Files saved">
      <div className="run-files-head">
        <div>
          <h3 className="run-files-title">Files saved</h3>
          <p className="panel-desc">
            {plural(files.length, 'file')}
            {total ? ` · ${fmtSize(total)}` : ''}
            {rows.some((r) => r.part) ? ' · large months are split into parts' : ''}
            {deleted ? ` · ${deleted === rows.length ? 'all' : deleted} deleted` : ''}
          </p>
        </div>
        <div className="inline-form">
          {codes.map(([code, name]) => (
            <Link key={code} href={`/files?country=${code}`} className="btn btn-ghost btn-sm">
              {codes.length > 1 ? `All ${name} files` : 'See all files'} <Icon.ChevronRight size={13} />
            </Link>
          ))}
          {available.length > 1 && (
            <Button size="sm" variant="secondary" icon={<Icon.Download size={14} />} loading={busy === 'all'} onClick={() => download(available.map((r) => r.path), 'all')}>
              Download all (zip)
            </Button>
          )}
        </div>
      </div>
      {deleted === rows.length && (
        <div className="note note-warn note-tight">
          <Icon.Trash size={14} />
          <span>{rows.length === 1 ? 'This file was deleted' : 'These files were deleted'} from storage. Extract the months again to recreate them.</span>
        </div>
      )}
      <div className="month-list">
        {groups.map((group) => {
          const first = group[0];
          const key = `${first.country}|${first.period}`;
          const ready = group.filter(isAvailable);
          const parts = group.filter((r) => r.part).length;
          return (
            <section key={key} className="month-group">
              <header className="month-group-head">
                <span className="month-group-name">{[first.country, first.period && fmtMonth(first.period)].filter(Boolean).join(' · ') || 'Other files'}</span>
                <span className="month-group-meta">
                  {parts ? `${plural(parts, 'part')} · ` : ''}
                  {sizeOf(group) ? fmtSize(sizeOf(group)) : ''}
                </span>
                {ready.length > 1 && (
                  <span className="month-group-actions">
                    <Button size="sm" variant="ghost" icon={<Icon.Download size={14} />} loading={busy === key} onClick={() => download(ready.map((r) => r.path), key)}>
                      Month (zip)
                    </Button>
                  </span>
                )}
              </header>
              <ul className="file-list">
                {group.map((r) => {
                  const gone = !isAvailable(r);
                  return (
                    <li key={r.path} className={`file-row ${gone ? 'is-gone' : ''}`}>
                      <FileIcon name={r.name} />
                      <span className="file-row-text" title={r.path}>
                        <span className="file-row-name">
                          {r.name}{' '}
                          {gone && (
                            <Badge tone="red" dot>
                              Deleted
                            </Badge>
                          )}
                        </span>
                        <span className="file-row-meta">
                          {[r.part && `Part ${r.part} of ${parts}`, r.stored ? fmtSize(r.stored.sizeBytes) : gone ? 'Removed from storage' : 'Whole month'].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {!gone && (
                        <Button size="sm" variant="ghost" iconOnly aria-label={`Download ${r.name}`} title="Download" loading={busy === r.path} icon={<Icon.Download size={16} />} onClick={() => download([r.path], r.path)} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
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
