'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Run, RunLog } from '@/lib/types';
import { describePlan, fmtDate, fmtDay, fmtDuration, fmtMonth, fmtRelative, fmtTime, TRIGGER_LABELS } from '@/lib/format';
import { useChangedKeys } from '@/lib/hooks';
import { Badge, Button, formatLogMessage, Icon, Skeleton, useToast, type Tone } from './ui';

const STATUS_TONE: Record<Run['status'], Tone> = { COMPLETED: 'green', RUNNING: 'blue', FAILED: 'red', INTERRUPTED: 'amber', STOPPED: 'amber' };

function StatusBadge({ run }: { run: Run }) {
  return (
    <Badge tone={STATUS_TONE[run.status]} live={run.status === 'RUNNING'}>
      {run.status.charAt(0) + run.status.slice(1).toLowerCase()}
    </Badge>
  );
}

function fmtTimer(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return '00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` : `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function fmtEta(ms: number): string {
  if (ms <= 0 || !Number.isFinite(ms)) return '—';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `~${h}h ${m}m`;
  if (m > 0) return `~${m}m`;
  return `~${total}s`;
}

function describeRun(run: Run): string {
  return run.params?.plans?.map(describePlan).join('; ') || TRIGGER_LABELS[run.trigger] || run.trigger;
}

/** Flags and problems worth a person's attention */
function runNotes(run: Run): { tone: 'amber' | 'red'; text: string }[] {
  const s = run.stats;
  return [
    ...(s.flags ?? []).map((f) => ({ tone: 'amber' as const, text: f.message })),
    ...Object.entries(s.unpublishedPeriods ?? {}).map(([k, v]) => ({ tone: 'amber' as const, text: `${k}: no records for ${v.map(fmtMonth).join(', ')}` })),
    ...Object.entries(s.invalidHsCodes ?? {}).map(([k, v]) => ({ tone: 'amber' as const, text: `${k}: ${v.length} invalid HS code${v.length === 1 ? '' : 's'} skipped` })),
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
  const worked = s.completed + s.noData + s.failed;
  const perSec = worked / (elapsedMs / 1000);
  const remaining = Math.max(0, total - finished);
  return {
    finished,
    total,
    remaining,
    elapsedMs,
    perMin: perSec * 60,
    pct: total > 0 ? Math.min(100, Math.round((finished / total) * 100)) : 0,
    etaMs: perSec > 0 && remaining > 0 ? (remaining / perSec) * 1000 : 0,
  };
}

/** Stacked bar: each segment is a share of the run's planned tasks */
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
      <div className="outcome-bar" title={`${finished.toLocaleString()} of ${(s.planned ?? finished).toLocaleString()} tasks`}>
        {parts.map((p) => (
          <span key={p.key} className={`seg seg-${p.key}`} style={{ width: `${(p.n / total) * 100}%` }} />
        ))}
      </div>
      <div className="outcome-text">
        {parts.length === 0
          ? run.status === 'RUNNING'
            ? 'Starting…'
            : 'Nothing to do'
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

function StopButton({ run }: { run: Run }) {
  const { refreshRuns } = useApp();
  const toast = useToast();
  const [stopping, setStopping] = useState(false);
  async function stop(e: React.MouseEvent) {
    e.stopPropagation();
    setStopping(true);
    try {
      await api.stopRun(run.id);
      toast('ok', 'Extraction stopping', 'Tasks in flight finish; files are saved for the months already touched.');
      refreshRuns();
    } catch (err) {
      toast('err', 'Could not stop the extraction', err instanceof ApiError ? err.message : 'The API server did not respond.');
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

function ExtractionRow({ run, flash }: { run: Run; flash: boolean }) {
  const router = useRouter();
  const p = useProgress(run);
  const notes = runNotes(run);
  const open = () => router.push(`/extractions/${run.id}`);

  return (
    <tr className={`clickable ${flash ? 'flash' : ''}`} onClick={open}>
      <td className="nowrap" title={fmtDate(run.startedAt)}>
        <div className="cell-strong">{fmtTime(run.startedAt)}</div>
        <div className="cell-sub">{fmtDay(run.startedAt)}</div>
      </td>
      <td>
        <Link href={`/extractions/${run.id}`} className="cell-strong row-link" onClick={(e) => e.stopPropagation()}>
          {describeRun(run)}
        </Link>
        <div className="cell-sub" style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusBadge run={run} />
          {notes.length > 0 && (
            <Badge tone={notes.some((n) => n.tone === 'red') ? 'red' : 'amber'}>
              {notes.length} flag{notes.length === 1 ? '' : 's'}
            </Badge>
          )}
          {run.params?.startedBy && <span>by {run.params.startedBy}</span>}
        </div>
      </td>
      <td className="cell-outcome">
        {run.status === 'RUNNING' ? (
          <div className="outcome">
            <div className="stats-progress-track">
              <div className="stats-progress-bar" style={{ width: `${p.pct}%` }} />
            </div>
            <div className="outcome-text">
              <b>{p.pct}%</b> · {p.finished.toLocaleString()} / {p.total.toLocaleString()} tasks
              {p.finished >= 3 && p.etaMs > 0 ? ` · ${fmtEta(p.etaMs)} left` : ''}
            </div>
          </div>
        ) : (
          <Outcome run={run} />
        )}
      </td>
      <td className="nowrap cell-sub-color">{run.finishedAt ? fmtDuration(run.startedAt, run.finishedAt) : fmtTimer(p.elapsedMs)}</td>
      <td className="nowrap">
        {run.stats.files.length ? (
          <span className="files-count">
            <Icon.File size={14} /> {run.stats.files.length}
          </span>
        ) : (
          <span className="faint">—</span>
        )}
      </td>
      <td className="cell-actions nowrap">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {run.status === 'RUNNING' && <StopButton run={run} />}
          <span className="row-chevron">
            <Icon.ChevronRight size={15} />
          </span>
        </div>
      </td>
    </tr>
  );
}

type Filter = 'all' | 'running' | 'attention';

const needsAttention = (r: Run) => r.status === 'FAILED' || r.status === 'INTERRUPTED' || r.stats.failed > 0 || (r.stats.flags?.length ?? 0) > 0;

/** Extractions page: every extraction, running ones first. Logs open with an extraction. */
export function ExtractionsList() {
  const { runs, refreshing, refreshRuns } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const list = useMemo(() => {
    const all = runs ?? [];
    return [...all.filter((r) => r.status === 'RUNNING'), ...all.filter((r) => r.status !== 'RUNNING')];
  }, [runs]);
  const shown = list.filter((r) => (filter === 'all' ? true : filter === 'running' ? r.status === 'RUNNING' : needsAttention(r)));
  const changed = useChangedKeys(list.map((r) => ({ key: r.id, signature: r.status })));
  const running = list.filter((r) => r.status === 'RUNNING').length;
  const attention = list.filter(needsAttention).length;

  return (
    <section className="panel glass panel-flush reveal" style={{ '--i': 1 } as React.CSSProperties}>
      <div className="panel-head padded" style={{ flexWrap: 'wrap' }}>
        <div>
          <h2 className="panel-title">Extractions</h2>
          <p className="panel-desc">{runs ? `${list.length} most recent · open one to see its logs` : 'Loading…'}</p>
        </div>
        <div className="toolbar">
          <div className="chip-group" role="group" aria-label="Filter extractions">
            <button type="button" className={`chip-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              All
            </button>
            <button type="button" className={`chip-btn ${filter === 'running' ? 'active' : ''}`} onClick={() => setFilter('running')}>
              Running{running ? ` (${running})` : ''}
            </button>
            <button type="button" className={`chip-btn ${filter === 'attention' ? 'active' : ''}`} onClick={() => setFilter('attention')}>
              Needs attention{attention ? ` (${attention})` : ''}
            </button>
          </div>
          <Button variant="secondary" size="sm" icon={<Icon.Refresh size={14} />} loading={refreshing.runs} onClick={refreshRuns}>
            Refresh
          </Button>
        </div>
      </div>

      {runs === null ? (
        <div className="padded" style={{ display: 'grid', gap: 10 }}>
          <Skeleton height={36} />
          <Skeleton height={36} />
        </div>
      ) : shown.length === 0 ? (
        <p className="empty">
          {list.length ? 'No extractions match this filter.' : 'No extractions yet.'}{' '}
          <Link href="/extract" className="link">
            Start one
          </Link>
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 96 }}>Started</th>
                <th>Extraction</th>
                <th style={{ width: 280 }}>Progress</th>
                <th style={{ width: 100 }}>Duration</th>
                <th style={{ width: 64 }}>Files</th>
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
  );
}

/** One extraction: flags, live logs, metrics and its files */
export function ExtractionDetail({ id }: { id: string }) {
  const { runs } = useApp();
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
  return <ExtractionDetailBody run={run} />;
}

function ExtractionDetailBody({ run }: { run: Run }) {
  const toast = useToast();
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const [following, setFollowing] = useState(true);

  // Logs load when an extraction is opened, and stream while it runs
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .runLogs(run.id)
        .then((data) => alive && setLogs(data))
        .catch(() => {})
        .finally(() => alive && setLogsLoaded(true));
    load();
    const timer = run.status === 'RUNNING' ? setInterval(load, 1500) : null;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [run.id, run.status]);

  // Stay pinned to the newest line unless the reader scrolled up
  useEffect(() => {
    if (followRef.current && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const p = useProgress(run);
  const s = run.stats;
  const notes = runNotes(run);

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
      .then(() => toast('ok', 'Logs copied', `${logs.length} lines`));
  }

  return (
    <section className="panel glass reveal" style={{ '--i': 1 } as React.CSSProperties}>
      <div className="panel-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="panel-title">{describeRun(run)}</h2>
          <p className="panel-desc">
            Started {fmtDate(run.startedAt)} ({fmtRelative(run.startedAt)}){run.params?.startedBy ? ` by ${run.params.startedBy}` : ''}
            {run.finishedAt ? ` · took ${fmtDuration(run.startedAt, run.finishedAt)}` : ''}
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

      <div className="run-drawer-panel">
        <div className="run-drawer-header">
          <div className="run-drawer-title">
            <span style={{ fontWeight: 600, fontSize: 12 }}>Logs</span>
            <span className="cell-sub" style={{ fontSize: 11, marginLeft: 8 }}>
              {logs.length} line{logs.length === 1 ? '' : 's'}
              {run.status === 'RUNNING' && ' · streaming live'}
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
              {!logsLoaded ? (
                <div className="logs-empty">Loading logs…</div>
              ) : logs.length === 0 ? (
                <div className="logs-empty">
                  {run.status === 'RUNNING' ? 'Starting tasks and waiting for output…' : 'No logs kept for this run (logs are held in memory until the server restarts).'}
                </div>
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
            {!following && run.status === 'RUNNING' && (
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
                {run.status === 'RUNNING' ? (
                  <span className="live-status-badge">
                    <span className="live-pulse-dot" /> Live metrics
                  </span>
                ) : (
                  <span className="static-status-badge">Summary</span>
                )}
              </div>
              <span className="stats-panel-pct">{p.pct}%</span>
            </div>
            <div className="stats-progress-track">
              <div className="stats-progress-bar" style={{ width: `${p.pct}%` }} />
            </div>
            <div className="stats-timer-grid">
              <div className="stats-timer-cell">
                <span className="stats-cell-label">Elapsed</span>
                <span className="stats-cell-val font-mono">{fmtTimer(p.elapsedMs)}</span>
              </div>
              <div className="stats-timer-cell">
                <span className="stats-cell-label">{run.status === 'RUNNING' ? 'Est. remaining' : 'Status'}</span>
                <span className="stats-cell-val font-mono">{run.status === 'RUNNING' ? (p.finished >= 3 ? fmtEta(p.etaMs) : 'Estimating…') : run.status}</span>
              </div>
            </div>
            <div className="stats-breakdown">
              <div className="stats-breakdown-row">
                <span className="breakdown-name">
                  <span className="breakdown-bullet bullet-done" /> Done, with data
                </span>
                <span className="breakdown-count">{s.completed.toLocaleString()}</span>
              </div>
              <div className="stats-breakdown-row">
                <span className="breakdown-name">
                  <span className="breakdown-bullet bullet-none" /> Done, 0 records
                </span>
                <span className="breakdown-count">{s.noData.toLocaleString()}</span>
              </div>
              {s.failed > 0 && (
                <div className="stats-breakdown-row">
                  <span className="breakdown-name">
                    <span className="breakdown-bullet bullet-failed" /> Failed
                  </span>
                  <span className="breakdown-count text-red">{s.failed.toLocaleString()}</span>
                </div>
              )}
              {s.skipped > 0 && (
                <div className="stats-breakdown-row">
                  <span className="breakdown-name">
                    <span className="breakdown-bullet bullet-skipped" /> Skipped
                  </span>
                  <span className="breakdown-count text-muted">{s.skipped.toLocaleString()}</span>
                </div>
              )}
              <div className="stats-breakdown-row stats-breakdown-total">
                <span className="breakdown-name">{run.status === 'RUNNING' ? 'Remaining tasks' : 'Total tasks'}</span>
                <span className="breakdown-count font-semibold">
                  {(run.status === 'RUNNING' ? p.remaining : p.total).toLocaleString()}
                  {run.status === 'RUNNING' && <span className="total-sub"> / {p.total.toLocaleString()}</span>}
                </span>
              </div>
            </div>
            {run.status === 'RUNNING' && p.perMin > 0 && (
              <div className="stats-rate-info">
                Speed: <b>{p.perMin < 60 ? `${p.perMin.toFixed(1)} tasks/min` : `${(p.perMin / 60).toFixed(1)} tasks/sec`}</b>
              </div>
            )}
            {s.files.length > 0 && (
              <div className="stats-files-section">
                <div className="stats-files-title">
                  <Icon.File size={12} /> {s.files.length} file{s.files.length === 1 ? '' : 's'} saved
                </div>
                <div className="stats-files-list">
                  {s.files.map((file) => (
                    <button key={file} type="button" className="stats-file-chip" title={`Download ${file}`} onClick={() => api.download(file)}>
                      <Icon.Download size={11} />
                      <span className="stats-file-name">{file.split('/').pop()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
