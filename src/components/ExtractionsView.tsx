'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, extractor } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Run, RunLog } from '@/lib/types';
import { fmtDate, fmtDay, fmtMonth, fmtMs, fmtRange, fmtRelative, fmtTime, plural } from '@/lib/format';
import { useChangedKeys } from '@/lib/hooks';
import { describeRun, fmtRecords, isRunning, needsAttention, requestCount, runNotes, runPeriods, timeTaken } from '@/lib/runs';
import { extractHref, MarkCompletedButton, RemoveMonthsButton } from './CountryAction';
import { Elapsed, formatLogMessage, RunBar, RunFiles, RunOutcome, RunStatusBadge, StopButton, useProgress } from './RunParts';
import { ServiceNotice } from './ServiceNotice';
import { Badge, Button, Empty, FilterTabs, Icon, LoadingPanel, Panel, ProgressBar, revealStyle, Skeleton, StatTiles, useToast } from './ui';

function ExtractionRow({ run, flash }: { run: Run; flash: boolean }) {
  const router = useRouter();
  const notes = runNotes(run);

  return (
    <tr className={`clickable ${flash ? 'flash' : ''}`} onClick={() => router.push(`/extractions/${run.id}`)}>
      <td className="nowrap" title={fmtDate(run.startedAt)}>
        <div className="cell-strong">{fmtTime(run.startedAt)}</div>
        <div className="cell-sub">{fmtDay(run.startedAt)}</div>
      </td>
      <td>
        <Link href={`/extractions/${run.id}`} className="cell-strong row-link" onClick={(e) => e.stopPropagation()}>
          {describeRun(run)}
        </Link>
        <div className="cell-sub row-meta">
          <RunStatusBadge run={run} />
          {notes.length > 0 && <Badge tone={notes.some((n) => n.tone === 'red') ? 'red' : 'amber'} dot>
            {plural(notes.length, 'flag')}
          </Badge>}
          {run.params?.startedBy && <span>by {run.params.startedBy}</span>}
        </div>
      </td>
      <td className="cell-outcome">
        <RunBar run={run} />
      </td>
      <td className="nowrap cell-sub-color">{fmtRecords(run)}</td>
      <td className="nowrap cell-sub-color">{isRunning(run) ? <Elapsed run={run} /> : timeTaken(run)}</td>
      <td className="cell-actions nowrap">
        <div className="row-actions">
          {isRunning(run) && <StopButton run={run} />}
          <span className="row-chevron">
            <Icon.ChevronRight size={15} />
          </span>
        </div>
      </td>
    </tr>
  );
}

type Filter = 'all' | 'attention';

/** Extractions running on the service right now, with their progress */
function LiveSection() {
  const { runs, serviceLive } = useApp();
  const live = (runs ?? []).filter(isRunning);
  if (!serviceLive) return null;

  return (
    <section className="live-section reveal" style={revealStyle(1)} aria-label="Running now">
      <div className="section-head">
        <h2 className="section-title">
          Running now
          {live.length ? (
            <Badge tone="green" live>
              {live.length} running
            </Badge>
          ) : (
            <Badge dot>Idle</Badge>
          )}
        </h2>
        <Link href="/extract" className="btn btn-primary btn-sm">
          <Icon.Play size={12} /> New extraction
        </Link>
      </div>
      {live.length === 0 ? (
        <p className="live-empty">Nothing is running on the extraction service. New extractions show up here with live progress.</p>
      ) : (
        <div className="live-cards">
          {live.map((r) => (
            <LiveCard key={r.id} run={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function LiveCard({ run }: { run: Run }) {
  const p = useProgress(run);
  return (
    <Link href={`/extractions/${run.id}`} className="live-card">
      <div className="live-card-head">
        <span className="cell-strong">{describeRun(run)}</span>
        <StopButton run={run} />
      </div>
      <ProgressBar pct={p.pct} />
      <div className="live-card-meta">
        <span>
          <b>{p.pct}%</b> · {p.finished.toLocaleString()} / {p.total.toLocaleString()} requests
        </span>
        <span>{fmtRecords(run)} rows</span>
        <span>
          {fmtMs(p.elapsedMs)}
          {p.eta ? ` · ${p.eta} left` : ''}
        </span>
      </div>
      {run.params?.startedBy && <span className="cell-sub">Started by {run.params.startedBy}</span>}
    </Link>
  );
}

/** Extractions page: what runs now (from the service), then the history (from the database) */
export function ExtractionsList() {
  const { runs, refreshing, refreshRuns, serviceLive } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  // While the service is live, its running extractions have their own section above
  const list = useMemo(() => (runs ?? []).filter((r) => !(serviceLive && isRunning(r))), [runs, serviceLive]);
  const shown = filter === 'all' ? list : list.filter(needsAttention);
  const changed = useChangedKeys(list.map((r) => ({ key: r.id, signature: r.status })));
  const attention = list.filter(needsAttention).length;

  return (
    <>
      <ServiceNotice impact="Live progress and new extractions are unavailable; the history below comes from the database." />
      <LiveSection />
      <Panel
        i={2}
        flush
        title="Previous extractions"
        desc={runs ? `${list.length} most recent` : 'Loading…'}
        actions={
          <div className="toolbar">
            <FilterTabs<Filter>
              label="Filter extractions"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: list.length },
                { value: 'attention', label: 'Needs attention', count: attention },
              ]}
            />
            <Button variant="secondary" size="sm" icon={<Icon.Refresh size={14} />} loading={refreshing.runs} onClick={refreshRuns}>
              Refresh
            </Button>
          </div>
        }
      >
        {runs === null ? (
          <div className="padded skeleton-rows">
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
        ) : shown.length === 0 ? (
          <Empty>
            {list.length ? 'No extractions match this filter.' : 'No extractions yet.'}{' '}
            {serviceLive && (
              <Link href="/extract" className="link">
                Start one
              </Link>
            )}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 96 }}>Started</th>
                  <th>Extraction</th>
                  <th style={{ width: 280 }}>Progress</th>
                  <th style={{ width: 100 }}>Records</th>
                  <th style={{ width: 100 }}>Time taken</th>
                  <th style={{ width: 110 }} />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <ExtractionRow key={r.id} run={r} flash={changed.has(r.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/**
 * After a run: for each country it covered, the months still waiting to be checked (with one
 * click to mark them completed), or a way to run it again when it did not finish.
 */
function AfterRun({ run }: { run: Run }) {
  const { countries } = useApp();
  const plans = run.params?.plans ?? [];
  const failed = run.status !== 'COMPLETED';
  const items = plans
    .map((plan) => {
      const country = countries?.find((c) => c.code === plan.countryCode);
      const toCheck = country ? runPeriods(run, country.code).filter((p) => country.extractingMonths.includes(p)) : [];
      const done = country ? runPeriods(run, country.code).filter((p) => country.completedMonths.includes(p)) : [];
      return country ? { plan, country, toCheck, done } : null;
    })
    .filter((x) => x !== null);
  if (!items.length) return null;

  return (
    <div className="after-run">
      {items.map(({ plan, country, toCheck, done }) => (
        <div key={plan.countryCode} className={`next-step ${toCheck.length ? 'next-review' : failed ? 'next-due' : 'next-done'}`}>
          <div className="next-step-text">
            <span className="next-step-eyebrow">
              {country.name} <span className="mono">{country.code}</span>
            </span>
            <span className="next-step-title">
              {toCheck.length
                ? `${fmtRange(toCheck)}: check the files, then mark ${toCheck.length === 1 ? 'it' : 'them'} completed`
                : done.length
                  ? `${fmtRange(done)} ${done.length === 1 ? 'is' : 'are'} marked completed`
                  : failed
                    ? `${fmtRange(plan.periods)} did not finish`
                    : 'Nothing left to check'}
            </span>
            {toCheck.length > 0 && failed && <span className="next-step-help">This extraction did not finish, so some months may be incomplete. Run it again if files are missing.</span>}
          </div>
          <div className="next-step-actions">
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
          </div>
        </div>
      ))}
    </div>
  );
}

/** One extraction: flags, then live logs while it runs, or its summary and next step once it ended */
export function ExtractionDetail({ id }: { id: string }) {
  const { runs, serviceLive } = useApp();
  const fromList = runs?.find((r) => r.id === id);
  const [fetched, setFetched] = useState<Run | null>(null);
  const [missing, setMissing] = useState(false);
  const run = fromList ?? fetched;

  // Runs older than the list's 50 are fetched on their own
  useEffect(() => {
    if (fromList || runs === null) return;
    api.run(id).then(setFetched).catch(() => setMissing(true));
  }, [id, fromList, runs]);

  if (missing) {
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
  if (!run) return <LoadingPanel />;

  const notes = runNotes(run);
  const running = isRunning(run);
  return (
    <>
      {!running && <AfterRun run={run} />}
      <Panel
        i={1}
        title={describeRun(run)}
        desc={`Started ${fmtDate(run.startedAt)} (${fmtRelative(run.startedAt)})${run.params?.startedBy ? ` by ${run.params.startedBy}` : ''}`}
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
              <Link href="/settings" className="link">
                Settings
              </Link>
            </span>
          </div>
        )}
        {running && serviceLive ? <LiveRun run={run} /> : <RunSummary run={run} />}
      </Panel>
    </>
  );
}

/** A finished extraction: its logs are gone, so show what it did */
function RunSummary({ run }: { run: Run }) {
  return (
    <>
      <StatTiles
        inset
        tiles={[
          { label: 'Status', value: <RunStatusBadge run={run} /> },
          { label: 'Time taken', value: timeTaken(run) },
          { label: 'Records', value: fmtRecords(run) },
          { label: 'Requests', value: requestCount(run).toLocaleString() },
        ]}
      />
      <RunOutcome run={run} />
      <RunFiles files={run.stats.files} />
    </>
  );
}

/** A running extraction: streaming logs next to live metrics */
function LiveRun({ run }: { run: Run }) {
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
            <div className="stats-panel-title">
              <Badge tone="green" live>
                Live metrics
              </Badge>
            </div>
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
                <span className="breakdown-count">{b.n.toLocaleString()}</span>
              </div>
            ))}
            <div className="stats-breakdown-row">
              <span className="breakdown-name">Records so far</span>
              <span className="breakdown-count">{fmtRecords(run)}</span>
            </div>
            <div className="stats-breakdown-row stats-breakdown-total">
              <span className="breakdown-name">Remaining requests</span>
              <span className="breakdown-count font-semibold">
                {p.remaining.toLocaleString()}
                <span className="total-sub"> / {p.total.toLocaleString()}</span>
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
      <RunFiles files={s.files} />
    </div>
  );
}
