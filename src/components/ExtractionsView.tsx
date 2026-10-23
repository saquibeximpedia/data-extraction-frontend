'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorText, extractor } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Run, RunLog } from '@/lib/types';
import { describePlan, fmtDate, fmtDay, fmtDuration, fmtMs, fmtRelative, fmtTime, plural } from '@/lib/format';
import { useChangedKeys } from '@/lib/hooks';
import { Badge, Button, formatLogMessage, Icon, Skeleton, useToast, type Tone } from './ui';

const STATUS_TONE: Record<Run['status'], Tone> = { COMPLETED: 'green', RUNNING: 'blue', FAILED: 'red', INTERRUPTED: 'amber', STOPPED: 'amber' };

function StatusBadge({ run }: { run: Run }) {
  const { serviceLive } = useApp();
  // The database says running, but the service that runs it can't be reached to confirm
  if (run.status === 'RUNNING' && !serviceLive) return <Badge tone="amber">Running? Service offline</Badge>;
  return (
    <Badge tone={STATUS_TONE[run.status]} live={run.status === 'RUNNING'}>
      {run.status.charAt(0) + run.status.slice(1).toLowerCase()}
    </Badge>
  );
}

const describeRun = (run: Run) => run.params?.plans?.map(describePlan).join('; ') || 'Extraction';
const fmtRecords = (run: Run) => (run.stats.records === undefined ? '—' : run.stats.records.toLocaleString());
const timeTaken = (run: Run) => (run.finishedAt ? fmtDuration(run.startedAt, run.finishedAt) : '—');

/** Flags and problems worth a person's attention */
function runNotes(run: Run): { tone: 'amber' | 'red'; text: string }[] {
  const s = run.stats;
  return [
    ...(s.flags ?? []).map((f) => ({ tone: 'amber' as const, text: f.message })),
    ...Object.entries(s.invalidHsCodes ?? {}).map(([k, v]) => ({ tone: 'amber' as const, text: `${k}: ${plural(v.length, 'invalid HS code')} skipped` })),
    ...(run.error ? [{ tone: 'red' as const, text: run.error }] : []),
  ];
}

function useProgress(run: Run) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run.status !== 'RUNNING') return;
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

/** Stacked bar: each segment is a share of the run's planned requests */
function Outcome({ run }: { run: Run }) {
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

function Progress({ run }: { run: Run }) {
  const p = useProgress(run);
  return (
    <div className="outcome">
      <div className="stats-progress-track">
        <div className="stats-progress-bar" style={{ width: `${p.pct}%` }} />
      </div>
      <div className="outcome-text">
        <b>{p.pct}%</b> · {p.finished.toLocaleString()} / {p.total.toLocaleString()} requests
        {p.eta ? ` · ${p.eta} left` : ''}
      </div>
    </div>
  );
}

function StopButton({ run }: { run: Run }) {
  const { refreshRuns, serviceLive } = useApp();
  const toast = useToast();
  const [stopping, setStopping] = useState(false);
  if (!serviceLive) return null;
  async function stop(e: React.MouseEvent) {
    e.stopPropagation();
    setStopping(true);
    try {
      await extractor.stopRun(run.id);
      toast('ok', 'Extraction stopping', 'Requests in flight finish; files are saved for the months that returned rows.');
      refreshRuns();
    } catch (err) {
      toast('err', 'Could not stop the extraction', errorText(err));
    } finally {
      setStopping(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" className="btn-stop" loading={stopping} icon={<Icon.Stop size={12} />} onClick={stop}>
      Stop
    </Button>
  );
}

/** A running extraction's elapsed time ticks every second */
function Elapsed({ run }: { run: Run }) {
  return <>{fmtMs(useProgress(run).elapsedMs)}</>;
}

function ExtractionRow({ run, flash }: { run: Run; flash: boolean }) {
  const router = useRouter();
  const notes = runNotes(run);
  const running = run.status === 'RUNNING';

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
          <StatusBadge run={run} />
          {notes.length > 0 && <Badge tone={notes.some((n) => n.tone === 'red') ? 'red' : 'amber'}>{plural(notes.length, 'flag')}</Badge>}
          {run.params?.startedBy && <span>by {run.params.startedBy}</span>}
        </div>
      </td>
      <td className="cell-outcome">{running ? <Progress run={run} /> : <Outcome run={run} />}</td>
      <td className="nowrap cell-sub-color">{fmtRecords(run)}</td>
      <td className="nowrap cell-sub-color">{running ? <Elapsed run={run} /> : timeTaken(run)}</td>
      <td className="cell-actions nowrap">
        <div className="row-actions">
          {running && <StopButton run={run} />}
          <span className="row-chevron">
            <Icon.ChevronRight size={15} />
          </span>
        </div>
      </td>
    </tr>
  );
}

type Filter = 'all' | 'attention';

const needsAttention = (r: Run) => r.status === 'FAILED' || r.status === 'INTERRUPTED' || r.stats.failed > 0 || (r.stats.flags?.length ?? 0) > 0;

/** Extractions running on the service right now, with their progress */
function LiveSection() {
  const { runs, service, serviceLive } = useApp();
  const live = (runs ?? []).filter((r) => r.status === 'RUNNING');

  if (service.status === 'offline') {
    return (
      <div className="service-note reveal">
        <span className="dot dot-red" />
        <span>
          <b>Live extractions are unavailable:</b> the extraction service at <span className="mono">{service.url}</span> is offline. History below comes from the database.
        </span>
        <Link href="/settings" className="btn btn-secondary btn-sm">
          <Icon.Gear size={13} /> Settings
        </Link>
      </div>
    );
  }
  if (!serviceLive) return null;

  return (
    <section className="live-section reveal" style={{ '--i': 1 } as React.CSSProperties} aria-label="Running now">
      <div className="section-head">
        <h2 className="section-title">
          <span className="dot dot-green dot-live" /> Running now
        </h2>
        <Link href="/extract" className="btn btn-primary btn-sm">
          <Icon.Play size={13} /> New extraction
        </Link>
      </div>
      {live.length === 0 ? (
        <p className="live-empty glass">Nothing is running on the extraction service.</p>
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
    <Link href={`/extractions/${run.id}`} className="live-card glass">
      <div className="live-card-head">
        <span className="cell-strong">{describeRun(run)}</span>
        <StopButton run={run} />
      </div>
      <div className="stats-progress-track">
        <div className="stats-progress-bar" style={{ width: `${p.pct}%` }} />
      </div>
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
  const list = useMemo(() => (runs ?? []).filter((r) => !(serviceLive && r.status === 'RUNNING')), [runs, serviceLive]);
  const shown = filter === 'all' ? list : list.filter(needsAttention);
  const changed = useChangedKeys(list.map((r) => ({ key: r.id, signature: r.status })));
  const attention = list.filter(needsAttention).length;
  const filters: [Filter, string][] = [
    ['all', 'All'],
    ['attention', `Needs attention${attention ? ` (${attention})` : ''}`],
  ];

  return (
    <>
    <LiveSection />
    <section className="panel glass panel-flush reveal" style={{ '--i': 2 } as React.CSSProperties}>
      <div className="panel-head padded" style={{ flexWrap: 'wrap' }}>
        <div>
          <h2 className="panel-title">Previous extractions</h2>
          <p className="panel-desc">{runs ? `${list.length} most recent` : 'Loading…'}</p>
        </div>
        <div className="toolbar">
          <div className="chip-group" role="group" aria-label="Filter extractions">
            {filters.map(([value, label]) => (
              <button key={value} type="button" className={`chip-btn ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" icon={<Icon.Refresh size={14} />} loading={refreshing.runs} onClick={refreshRuns}>
            Refresh
          </Button>
        </div>
      </div>

      {runs === null ? (
        <div className="padded skeleton-rows">
          <Skeleton height={36} />
          <Skeleton height={36} />
        </div>
      ) : shown.length === 0 ? (
        <p className="empty">
          {list.length ? 'No extractions match this filter.' : 'No extractions yet.'}{' '}
          {serviceLive && (
            <Link href="/extract" className="link">
              Start one
            </Link>
          )}
        </p>
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
    </section>
    </>
  );
}

/** One extraction: flags, then live logs while it runs, or its summary once it ended */
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
      <section className="panel glass">
        <p className="empty">
          This extraction was not found.{' '}
          <Link href="/extractions" className="link">
            Back to extractions
          </Link>
        </p>
      </section>
    );
  }
  if (!run) {
    return (
      <section className="panel glass">
        <Skeleton height={240} />
      </section>
    );
  }

  const notes = runNotes(run);
  return (
    <section className="panel glass reveal" style={{ '--i': 1 } as React.CSSProperties}>
      <div className="panel-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="panel-title">{describeRun(run)}</h2>
          <p className="panel-desc">
            Started {fmtDate(run.startedAt)} ({fmtRelative(run.startedAt)}){run.params?.startedBy ? ` by ${run.params.startedBy}` : ''}
          </p>
        </div>
        <div className="live-run-actions">
          <StatusBadge run={run} />
          {run.status === 'RUNNING' && <StopButton run={run} />}
        </div>
      </div>

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

      {run.status === 'RUNNING' && !serviceLive && (
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
      {run.status === 'RUNNING' && serviceLive ? <LiveRun run={run} /> : <RunSummary run={run} />}
    </section>
  );
}

function RunFiles({ files }: { files: string[] }) {
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

/** A finished extraction: its logs are gone, so show what it did */
function RunSummary({ run }: { run: Run }) {
  const s = run.stats;
  const tiles = [
    { label: 'Status', value: <StatusBadge run={run} /> },
    { label: 'Time taken', value: timeTaken(run) },
    { label: 'Records', value: fmtRecords(run) },
    { label: 'Requests', value: Math.max(s.planned ?? 0, s.completed + s.noData + s.failed + s.skipped).toLocaleString() },
  ];
  return (
    <>
      <div className="summary-grid">
        {tiles.map((t) => (
          <div key={t.label} className="summary-tile">
            <span className="stats-cell-label">{t.label}</span>
            <span className="summary-value">{t.value}</span>
          </div>
        ))}
      </div>
      <Outcome run={run} />
      <RunFiles files={s.files} />
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
          <span style={{ fontWeight: 600, fontSize: 12 }}>Live logs</span>
          <span className="cell-sub" style={{ fontSize: 11, marginLeft: 8 }}>
            {plural(logs.length, 'line')} · cleared when the extraction ends
          </span>
        </div>
        {logs.length > 0 && (
          <Button size="sm" variant="ghost" icon={<Icon.Copy size={12} />} onClick={copyLogs} style={{ height: 24, fontSize: 11 }}>
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
              <span className="live-status-badge">
                <span className="live-pulse-dot" /> Live metrics
              </span>
            </div>
            <span className="stats-panel-pct">{p.pct}%</span>
          </div>
          <div className="stats-progress-track">
            <div className="stats-progress-bar" style={{ width: `${p.pct}%` }} />
          </div>
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
          <RunFiles files={s.files} />
        </div>
      </div>
    </div>
  );
}
