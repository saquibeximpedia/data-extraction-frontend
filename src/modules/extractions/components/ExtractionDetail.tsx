'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MarkCompletedButton, RemoveMonthsButton } from '@/components/month-actions';
import { useProgress } from '@/components/run-progress';
import { ExtractionSkeleton } from '@/components/skeletons';
import { StepCard } from '@/components/step-card';
import { Button, Empty, Icon, Panel, ProgressBar, StatTiles, useToast, When } from '@/components/ui';
import { fmtMonth, fmtMs, fmtNumber, fmtRange, fmtTime, plural } from '@/lib/format';
import { describeRun, extractHref, fmtRecords, isRunning, requestCount, runNotes, runPeriods, timeTaken } from '@/lib/runs';
import type { Country, ExportFile, Run, RunLog } from '@/lib/types';
import { extractor } from '@/modules/service/client';
import { useApp } from '@/modules/service/store';
import { RunFiles } from './RunFiles';
import { formatLogMessage, RunOutcome, RunStatusBadge, StopButton } from './RunParts';

/**
 * After a run: for each country it covered, the months still waiting to be checked (with one
 * click to mark them completed), or a way to run it again when it did not finish.
 */
function AfterRun({ run, countries }: { run: Run; countries: Country[] }) {
  const failed = run.status !== 'COMPLETED';
  const items = (run.params?.plans ?? []).flatMap((plan) => {
    const country = countries.find((c) => c.code === plan.countryCode);
    if (!country) return [];
    const periods = runPeriods(run, country.code);
    return [{ plan, country, toCheck: periods.filter((p) => country.extractingMonths.includes(p)), done: periods.filter((p) => country.completedMonths.includes(p)) }];
  });
  if (!items.length) return null;

  return (
    <div className="after-run">
      {items.map(({ plan, country, toCheck, done }) => (
        <StepCard
          key={plan.countryCode}
          kind={toCheck.length ? 'review' : failed ? 'due' : 'done'}
          label={
            <>
              {country.name} <span className="mono">{country.code}</span>
            </>
          }
          title={
            toCheck.length
              ? `${fmtRange(toCheck)}: check the files, then mark ${toCheck.length === 1 ? 'it' : 'them'} completed`
              : done.length
                ? `${fmtRange(done)} ${done.length === 1 ? 'is' : 'are'} marked completed`
                : failed
                  ? `${fmtRange(plan.periods)} did not finish`
                  : 'Nothing left to check'
          }
          actions={
            <>
              {failed && (
                <Link href={extractHref(country.code, plan.periods)} className="btn btn-secondary btn-md">
                  <Icon.Refresh size={14} /> Run again
                </Link>
              )}
              {toCheck.length > 0 && (
                <>
                  <RemoveMonthsButton country={country} periods={toCheck} size="md" />
                  <Link href={`/files?country=${country.code}`} className="btn btn-secondary btn-md">
                    <Icon.Folder size={14} /> Files
                  </Link>
                  <MarkCompletedButton country={country} periods={toCheck} size="md" label={toCheck.length === 1 ? `Mark ${fmtMonth(toCheck[0])} completed` : `Mark ${plural(toCheck.length, 'month')} completed`} />
                </>
              )}
            </>
          }
        >
          {toCheck.length > 0 && failed && <span className="next-step-help">This extraction did not finish, so some months may be incomplete. Run it again if files are missing.</span>}
        </StepCard>
      ))}
    </div>
  );
}

/** A finished extraction: its logs are gone, so show what it did */
function RunSummary({ run, files, countries }: { run: Run; files: ExportFile[] | null; countries: Country[] }) {
  return (
    <>
      <StatTiles
        inset
        tiles={[
          { label: 'Status', value: <RunStatusBadge run={run} /> },
          { label: 'Time taken', value: timeTaken(run) },
          { label: 'Records', value: fmtRecords(run) },
          { label: 'Requests', value: fmtNumber(requestCount(run)) },
        ]}
      />
      <RunOutcome run={run} />
      <RunFiles files={run.stats.files} stored={files} countries={countries} />
    </>
  );
}

/** A running extraction: streaming logs next to live metrics */
function LiveRun({ run, files, countries }: { run: Run; files: ExportFile[] | null; countries: Country[] }) {
  const toast = useToast();
  const [logs, setLogs] = useState<RunLog[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const [following, setFollowing] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      extractor
        .runLogs(run.id)
        .then((data) => alive && setLogs(data))
        .catch(() => {});
    load();
    const timer = setInterval(load, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [run.id]);

  // Stay pinned to the newest line unless the reader scrolled up
  useEffect(() => {
    if (followRef.current && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const p = useProgress(run);
  const s = run.stats;

  function onScroll() {
    const el = logRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    followRef.current = atBottom;
    setFollowing(atBottom);
  }
  function follow() {
    followRef.current = true;
    setFollowing(true);
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }
  function copyLogs() {
    navigator.clipboard
      ?.writeText(logs.map((l) => `[${fmtTime(l.timestamp)}] ${l.message}`).join('\n'))
      .then(() => toast('ok', 'Logs copied', plural(logs.length, 'line')));
  }

  const breakdown = [
    { label: 'Done, with data', n: s.completed, bullet: 'bullet-done' },
    { label: 'Done, 0 records', n: s.noData, bullet: 'bullet-none' },
    { label: 'Failed', n: s.failed, bullet: 'bullet-failed' },
    { label: 'Skipped', n: s.skipped, bullet: 'bullet-skipped' },
  ].filter((b, i) => i < 2 || b.n > 0);

  return (
    <div className="run-drawer-panel">
      <div className="run-drawer-header">
        <div className="run-drawer-title">
          <span className="run-drawer-label">Live logs</span>
          <span className="cell-sub run-drawer-count">{plural(logs.length, 'line')} · cleared when the extraction ends</span>
        </div>
        {logs.length > 0 && (
          <Button size="sm" variant="ghost" icon={<Icon.Copy size={12} />} onClick={copyLogs} className="btn-xs">
            Copy
          </Button>
        )}
      </div>

      <div className="run-drawer-body">
        <div className="run-drawer-logs-wrap">
          <div className="logs-panel-view run-drawer-logs detail-logs" ref={logRef} onScroll={onScroll}>
            {logs.length === 0 ? (
              <div className="logs-empty">Starting requests and waiting for output…</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="log-row">
                  <span className="log-time-col">{fmtTime(log.timestamp)}</span>
                  {log.level !== 'info' && <span className={`log-tag log-tag-${log.level}`}>{log.level.toUpperCase()}</span>}
                  <span className="log-msg-col">{formatLogMessage(log.message)}</span>
                </div>
              ))
            )}
          </div>
          {!following && (
            <button type="button" className="logs-follow-pill" onClick={follow}>
              <Icon.ArrowDown size={12} />
              <span>Follow live logs</span>
              <span className="live-pulse-dot" />
            </button>
          )}
        </div>

        <div className="run-drawer-stats-panel detail-stats">
          <div className="stats-panel-head">
            {/* The status badge in the header already says it is running */}
            <span className="stats-panel-title">Live metrics</span>
            <span className="stats-panel-pct">{p.pct}%</span>
          </div>
          <ProgressBar pct={p.pct} />
          <div className="stats-timer-grid">
            <div className="stats-timer-cell">
              <span className="stats-cell-label">Elapsed</span>
              <span className="stats-cell-val font-mono">{fmtMs(p.elapsedMs)}</span>
            </div>
            <div className="stats-timer-cell">
              <span className="stats-cell-label">Est. remaining</span>
              <span className="stats-cell-val font-mono">{p.eta || 'Estimating…'}</span>
            </div>
          </div>
          <div className="stats-breakdown">
            {breakdown.map((b) => (
              <div key={b.label} className="stats-breakdown-row">
                <span className="breakdown-name">
                  <span className={`breakdown-bullet ${b.bullet}`} /> {b.label}
                </span>
                <span className="breakdown-count">{fmtNumber(b.n)}</span>
              </div>
            ))}
            <div className="stats-breakdown-row">
              <span className="breakdown-name">Records so far</span>
              <span className="breakdown-count">{fmtRecords(run)}</span>
            </div>
            <div className="stats-breakdown-row stats-breakdown-total">
              <span className="breakdown-name">Remaining requests</span>
              <span className="breakdown-count font-semibold">
                {fmtNumber(p.remaining)}
                <span className="total-sub"> / {fmtNumber(p.total)}</span>
              </span>
            </div>
          </div>
          {p.perMin > 0 && (
            <div className="stats-rate-info">
              Speed: <b>{p.perMin < 60 ? `${p.perMin.toFixed(1)} requests/min` : `${(p.perMin / 60).toFixed(1)} requests/sec`}</b>
            </div>
          )}
        </div>
      </div>
      <RunFiles files={s.files} stored={files} countries={countries} />
    </div>
  );
}

/**
 * One extraction: flags, then live logs while it runs, or its summary and next step once it
 * ended. The live service's copy wins over the database's; one that just started may only be live.
 */
export function ExtractionDetail({ id, stored, countries, files }: { id: string; stored: Run | null; countries: Country[]; files: ExportFile[] | null }) {
  const { liveRuns, serviceLive, service } = useApp();
  const run = liveRuns.find((r) => r.id === id) ?? stored;

  if (!run) {
    if (service.status === 'checking') return <ExtractionSkeleton />;
    return (
      <Panel>
        <Empty>
          This extraction was not found.{' '}
          <Link href="/extractions" className="link">
            Back to extractions
          </Link>
        </Empty>
      </Panel>
    );
  }

  const notes = runNotes(run);
  const running = isRunning(run);
  return (
    <>
      {!running && <AfterRun run={run} countries={countries} />}
      <Panel
        i={1}
        title={describeRun(run)}
        desc={
          <>
            Started <When value={run.startedAt} /> (<When value={run.startedAt} as="relative" />){run.params?.startedBy ? ` by ${run.params.startedBy}` : ''}
          </>
        }
        actions={
          <div className="live-run-actions">
            <RunStatusBadge run={run} />
            {running && <StopButton run={run} />}
          </div>
        }
      >
        {notes.length > 0 && (
          <ul className="run-flags">
            {notes.map((n) => (
              <li key={n.text} className={`run-flag run-flag-${n.tone}`}>
                <Icon.Alert size={14} />
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        )}

        {running && !serviceLive && (
          <div className="note note-warn note-tight">
            <Icon.Alert />
            <span>
              Live logs and progress come from the extraction service, which is offline. These numbers are the last ones it saved.{' '}
              <Link href="/service" className="link">
                Extraction service
              </Link>
            </span>
          </div>
        )}
        {running && serviceLive ? <LiveRun run={run} files={files} countries={countries} /> : <RunSummary run={run} files={files} countries={countries} />}
      </Panel>
    </>
  );
}
