'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Run, RunLog } from '@/lib/types';
import { fmtDate, fmtDay, fmtDuration, fmtMonth, fmtRelative, fmtTime, TRIGGER_LABELS } from '@/lib/format';
import { useChangedKeys } from '@/lib/hooks';
import { Badge, Button, Count, formatLogMessage, Icon, Menu, Skeleton, useToast, type MenuItem, type Tone } from './ui';

type GroupKey = 'running' | 'attention' | 'done';

const GROUPS: { key: GroupKey; title: string; tone: Tone }[] = [
  { key: 'running', title: 'In progress', tone: 'blue' },
  { key: 'attention', title: 'Needs attention', tone: 'amber' },
  { key: 'done', title: 'Completed', tone: 'green' },
];

function groupOf(r: Run): GroupKey {
  if (r.status === 'RUNNING') return 'running';
  if (r.status === 'FAILED' || r.status === 'INTERRUPTED' || r.stats.failed > 0) return 'attention';
  return 'done';
}

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
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

function fmtEta(ms: number): string {
  if (ms <= 0 || !Number.isFinite(ms)) return '—';
  const totalSecs = Math.round(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) {
    return `~${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `~${mins}m ${secs > 0 ? `${secs}s` : ''}`;
  }
  return `~${secs}s`;
}

function runNotes(run: Run): string[] {
  const s = run.stats;
  return [
    ...Object.entries(s.unpublishedPeriods).map(([k, v]) => `${k} hasn't published ${v.map(fmtMonth).join(', ')} yet`),
    ...Object.entries(s.invalidHsCodes).map(([k, v]) => `${k}: ${v.length} invalid HS code${v.length === 1 ? '' : 's'} skipped`),
    ...(run.error ? [run.error] : []),
  ];
}

/** Stacked bar: each segment is a share of the run's planned tasks; empty track is work still to do */
function Outcome({ run }: { run: Run }) {
  const s = run.stats;
  const parts = [
    { key: 'ok', n: s.completed, label: 'done' },
    { key: 'warn', n: s.noData, label: 'waiting' },
    { key: 'err', n: s.failed, label: 'failed' },
    { key: 'skip', n: s.skipped, label: 'skipped' },
  ].filter((p) => p.n > 0);
  const finished = parts.reduce((sum, p) => sum + p.n, 0);
  const total = Math.max(s.planned ?? 0, finished, 1);

  return (
    <div className="outcome">
      <div className="outcome-bar" title={`${finished} of ${s.planned ?? finished} tasks`}>
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
                <b>{p.n}</b> {p.label}
              </span>
            ))}
      </div>
    </div>
  );
}

function RunRow({ run, flash }: { run: Run; flash: boolean }) {
  const { refreshActivity } = useApp();
  const toast = useToast();
  const [stopping, setStopping] = useState(false);
  const [expanded, setExpanded] = useState(run.status === 'RUNNING');
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const s = run.stats;
  const [now, setNow] = useState(() => Date.now());

  // Tick live elapsed timer every second when running and drawer is expanded
  useEffect(() => {
    if (run.status !== 'RUNNING' || !expanded) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [run.status, expanded]);

  const startedMs = new Date(run.startedAt).getTime();
  const finishedMs = run.finishedAt ? new Date(run.finishedAt).getTime() : now;
  const elapsedMs = Math.max(1000, finishedMs - startedMs);

  const doneTasks = s.completed;
  const waitingTasks = s.noData;
  const failedTasks = s.failed;
  const skippedTasks = s.skipped;
  const finishedTasks = doneTasks + waitingTasks + failedTasks + skippedTasks;
  const totalTasks = Math.max(s.planned ?? 0, finishedTasks);
  const remainingTasks = Math.max(0, totalTasks - finishedTasks);
  const progressPct = totalTasks > 0 ? Math.min(100, Math.round((finishedTasks / totalTasks) * 100)) : 0;

  // Extraction speed and ETA calculation
  const tasksPerSec = finishedTasks / (elapsedMs / 1000);
  const tasksPerMin = finishedTasks / (elapsedMs / 60000);
  const etaMs = tasksPerSec > 0 && remainingTasks > 0 ? (remainingTasks / tasksPerSec) * 1000 : 0;

  // Poll / fetch logs when expanded
  useEffect(() => {
    if (!expanded) return;
    let active = true;
    setLoadingLogs(true);

    const fetchLogs = () => {
      api
        .getRunLogs(run.id)
        .then((data) => {
          if (active) {
            setLogs(data);
            setLoadingLogs(false);
          }
        })
        .catch(() => {
          if (active) setLoadingLogs(false);
        });
    };

    fetchLogs();

    let interval: NodeJS.Timeout | null = null;
    if (run.status === 'RUNNING') {
      interval = setInterval(fetchLogs, 1500);
    }

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [expanded, run.id, run.status]);

  const userScrolledUpRef = useRef(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  function handleScroll() {
    const el = logContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledUpRef.current = !isAtBottom;
    setUserScrolledUp(!isAtBottom);
  }

  function scrollToBottom() {
    userScrolledUpRef.current = false;
    setUserScrolledUp(false);
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }

  // When opening or status changes, reset to bottom
  useEffect(() => {
    if (expanded) {
      userScrolledUpRef.current = false;
      setUserScrolledUp(false);
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }
  }, [expanded]);

  // Auto-scroll when logs change during running ONLY if user hasn't scrolled up
  useEffect(() => {
    if (expanded && logContainerRef.current && !userScrolledUpRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, expanded]);

  async function handleStop() {
    setStopping(true);
    try {
      await api.stopRun(run.id);
      toast('ok', 'Extraction stopped', 'Process was aborted without killing the server.');
      refreshActivity();
    } catch (err: any) {
      toast('err', 'Could not stop extraction', err.message);
    } finally {
      setStopping(false);
    }
  }

  function handleCopyLogs() {
    const text = logs.map((l) => `[${fmtTime(l.timestamp)}] ${l.message}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      toast('ok', 'Logs copied to clipboard', `${logs.length} lines copied`);
    });
  }

  const hasLogs = run.status === 'RUNNING' || finishedTasks > 0 || Boolean(run.error) || logs.length > 0;

  const actions: MenuItem[] = [
    ...s.files.map((f) => ({ label: `Download ${f.split('/').pop()}`, icon: <Icon.Download />, href: api.downloadUrl(f) })),
    ...(run.status === 'RUNNING'
      ? [
          {
            label: 'Stop extraction',
            icon: <Icon.Stop />,
            onSelect: handleStop,
          },
        ]
      : []),
    {
      label: 'Copy run ID',
      icon: <Icon.Copy />,
      separator: true,
      onSelect: () => navigator.clipboard?.writeText(run.id).then(() => toast('ok', 'Run ID copied', run.id)),
    },
  ];

  return (
    <>
      <tr className={flash ? 'flash' : ''}>
        <td className="nowrap" title={fmtDate(run.startedAt)}>
          <div className="cell-strong">{fmtTime(run.startedAt)}</div>
          <div className="cell-sub">{fmtDay(run.startedAt)}</div>
        </td>
        <td>
          <div className="cell-strong">{TRIGGER_LABELS[run.trigger] ?? run.trigger}</div>
          <div className="cell-sub" style={{ marginTop: 4 }}>
            <StatusBadge run={run} />
          </div>
        </td>
        <td className="cell-outcome">
          <Outcome run={run} />
          {runNotes(run).map((n) => (
            <div key={n} className="cell-note">
              {n}
            </div>
          ))}
        </td>
        <td className="nowrap cell-sub-color">{run.finishedAt ? fmtDuration(run.startedAt, run.finishedAt) : '—'}</td>
        <td className="nowrap">
          {s.files.length ? (
            <span className="files-count">
              <Icon.File size={14} /> {s.files.length}
            </span>
          ) : (
            <span className="faint">—</span>
          )}
        </td>
        <td className="cell-actions nowrap">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            {run.status === 'RUNNING' && (
              <Button
                size="sm"
                variant="secondary"
                loading={stopping}
                icon={<Icon.Stop size={12} />}
                onClick={handleStop}
                title="Stop extraction process"
                style={{ color: 'var(--red)', borderColor: 'var(--red-line)', height: 26, fontSize: 11 }}
              >
                Stop
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className={`btn-logs ${expanded ? 'active' : ''}`}
              icon={
                <span className={`chevron-icon ${expanded ? 'rotated' : ''}`}>
                  <Icon.ChevronDown size={11} />
                </span>
              }
              onClick={() => setExpanded((e) => !e)}
              disabled={!hasLogs && run.status !== 'RUNNING'}
              title={!hasLogs && run.status !== 'RUNNING' ? 'No logs available' : expanded ? 'Collapse logs' : 'Expand logs'}
            >
              Logs
            </Button>
            <Menu items={actions} label="Run actions" />
          </div>
        </td>
      </tr>

      {/* Expandable live logs drawer right underneath the run row with smooth sliding transition */}
      <tr className={`run-drawer-row ${expanded ? 'expanded' : ''}`} aria-hidden={!expanded}>
        <td colSpan={6}>
          <div className="run-drawer-wrapper">
            <div className="run-drawer-inner">
              <div className="run-drawer-panel">
                <div className="run-drawer-header">
                  <div className="run-drawer-title">
                    <span style={{ fontWeight: 600, fontSize: 12 }}>
                      {run.params?.plans?.map((p: any) => `${p.countryCode} [${p.periods?.join(', ')}]`).join(', ') || run.trigger}
                    </span>
                    <span className="cell-sub" style={{ fontSize: 11, marginLeft: 8 }}>
                      {logs.length} line{logs.length === 1 ? '' : 's'} recorded
                      {run.status === 'RUNNING' && ' · streaming live'}
                    </span>
                  </div>
                  <div className="run-drawer-actions">
                    {logs.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Icon.Copy size={12} />}
                        onClick={handleCopyLogs}
                        style={{ height: 24, fontSize: 11 }}
                      >
                        Copy
                      </Button>
                    )}
                  </div>
                </div>

                <div className="run-drawer-body">
                  <div className="run-drawer-logs-wrap">
                    <div className="logs-panel-view run-drawer-logs" ref={logContainerRef} onScroll={handleScroll}>
                      {loadingLogs && logs.length === 0 ? (
                        <div className="logs-empty">Loading logs…</div>
                      ) : logs.length === 0 ? (
                        <div className="logs-empty">
                          {run.status === 'RUNNING' ? 'Starting tasks and waiting for output…' : 'No logs recorded for this run.'}
                        </div>
                      ) : (
                        logs.map((log, index) => (
                          <div key={index} className="log-row">
                            <span className="log-time-col">{fmtTime(log.timestamp)}</span>
                            {log.level !== 'info' && (
                              <span className={`log-tag log-tag-${log.level}`}>{log.level.toUpperCase()}</span>
                            )}
                            <span className="log-msg-col">{formatLogMessage(log.message)}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {userScrolledUp && run.status === 'RUNNING' && (
                      <button
                        type="button"
                        className="logs-follow-pill"
                        onClick={scrollToBottom}
                        title="Follow live streaming logs"
                      >
                        <Icon.ArrowDown size={12} />
                        <span>Follow live logs</span>
                        <span className="live-pulse-dot" />
                      </button>
                    )}
                  </div>

                  {/* Dedicated live metrics and ETA container */}
                  <div className="run-drawer-stats-panel">
                    <div className="stats-panel-head">
                      <div className="stats-panel-title">
                        {run.status === 'RUNNING' ? (
                          <span className="live-status-badge">
                            <span className="live-pulse-dot" /> Live Metrics
                          </span>
                        ) : (
                          <span className="static-status-badge">Extraction Summary</span>
                        )}
                      </div>
                      <span className="stats-panel-pct">{progressPct}%</span>
                    </div>

                    <div className="stats-progress-track">
                      <div className="stats-progress-bar" style={{ width: `${progressPct}%` }} />
                    </div>

                    <div className="stats-timer-grid">
                      <div className="stats-timer-cell">
                        <span className="stats-cell-label">Elapsed</span>
                        <span className="stats-cell-val font-mono">{fmtTimer(elapsedMs)}</span>
                      </div>
                      <div className="stats-timer-cell">
                        <span className="stats-cell-label">{run.status === 'RUNNING' ? 'Est. Remaining' : 'Status'}</span>
                        <span className="stats-cell-val font-mono">
                          {run.status === 'RUNNING' ? (finishedTasks >= 3 ? fmtEta(etaMs) : 'Estimating…') : run.status}
                        </span>
                      </div>
                    </div>

                    <div className="stats-breakdown">
                      <div className="stats-breakdown-row">
                        <span className="breakdown-name">
                          <span className="breakdown-bullet bullet-done" /> Done (with data)
                        </span>
                        <span className="breakdown-count">{doneTasks}</span>
                      </div>
                      <div className="stats-breakdown-row">
                        <span className="breakdown-name">
                          <span className="breakdown-bullet bullet-waiting" /> Waiting / No data
                        </span>
                        <span className="breakdown-count">{waitingTasks}</span>
                      </div>
                      {failedTasks > 0 && (
                        <div className="stats-breakdown-row">
                          <span className="breakdown-name">
                            <span className="breakdown-bullet bullet-failed" /> Failed
                          </span>
                          <span className="breakdown-count text-red">{failedTasks}</span>
                        </div>
                      )}
                      {skippedTasks > 0 && (
                        <div className="stats-breakdown-row">
                          <span className="breakdown-name">
                            <span className="breakdown-bullet bullet-skipped" /> Skipped
                          </span>
                          <span className="breakdown-count text-muted">{skippedTasks}</span>
                        </div>
                      )}
                      <div className="stats-breakdown-row stats-breakdown-total">
                        <span className="breakdown-name">
                          {run.status === 'RUNNING' ? 'Remaining tasks' : 'Total tasks'}
                        </span>
                        <span className="breakdown-count font-semibold">
                          {run.status === 'RUNNING' ? remainingTasks : totalTasks}
                          {run.status === 'RUNNING' && <span className="total-sub"> / {totalTasks}</span>}
                        </span>
                      </div>
                    </div>

                    {run.status === 'RUNNING' && tasksPerMin > 0 && (
                      <div className="stats-rate-info">
                        Speed:{' '}
                        <b>
                          {tasksPerMin < 60
                            ? `${tasksPerMin.toFixed(1)} tasks/min`
                            : `${(tasksPerMin / 60).toFixed(1)} tasks/sec`}
                        </b>
                      </div>
                    )}

                    {s.files.length > 0 && (
                      <div className="stats-files-section">
                        <div className="stats-files-title">
                          <Icon.File size={12} /> {s.files.length} File{s.files.length === 1 ? '' : 's'} Created
                        </div>
                        <div className="stats-files-list">
                          {s.files.map((file) => {
                            const fileName = file.split('/').pop() || file;
                            return (
                              <a
                                key={file}
                                href={api.downloadUrl(file)}
                                className="stats-file-chip"
                                title={`Download ${fileName}`}
                              >
                                <Icon.Download size={11} />
                                <span className="stats-file-name">{fileName}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

/** Full history, grouped into tinted sections */
export function RunsView() {
  const { runs, refreshing, refreshRuns } = useApp();
  const list = runs ?? [];
  const changed = useChangedKeys(list.map((r) => ({ key: r.id, signature: r.status })));
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({ running: false, attention: false, done: false });
  const groups = GROUPS.map((g) => ({ ...g, runs: list.filter((r) => groupOf(r) === g.key) })).filter((g) => g.runs.length > 0);

  return (
    <>
      <section className="panel glass panel-flush reveal" style={{ '--i': 1 } as React.CSSProperties}>
        <div className="panel-head padded">
          <p className="panel-desc">{runs ? `${list.length} most recent runs` : 'Loading…'}</p>
          <Button variant="secondary" size="sm" icon={<Icon.Refresh size={14} />} loading={refreshing.runs} onClick={refreshRuns}>
            Refresh
          </Button>
        </div>

        {runs === null && (
          <div className="padded" style={{ display: 'grid', gap: 10 }}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
        )}
        {runs !== null && groups.length === 0 && <p className="empty">No runs yet. Start one from Overview.</p>}

        {groups.map((g) => (
          <div key={g.key} className="group">
            <button
              type="button"
              className={`group-head group-${g.tone}`}
              onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}
              aria-expanded={!collapsed[g.key]}
            >
              <span className={`group-chevron ${collapsed[g.key] ? 'closed' : ''}`}>
                <Icon.ChevronDown />
              </span>
              {g.title}
              <Count tone={g.tone}>{g.runs.length}</Count>
            </button>
            {!collapsed[g.key] && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 96 }}>Started</th>
                      <th style={{ width: 190 }}>Type</th>
                      <th>Outcome</th>
                      <th style={{ width: 90 }}>Duration</th>
                      <th style={{ width: 64 }}>Files</th>
                      <th style={{ width: 160, textAlign: 'right' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {g.runs.map((r) => (
                      <RunRow key={r.id} run={r} flash={changed.has(r.id)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </section>
    </>
  );
}


/** Compact list for the Overview page */
export function RecentRuns({ limit = 6 }: { limit?: number }) {
  const { runs } = useApp();
  const list = (runs ?? []).slice(0, limit);
  const changed = useChangedKeys(list.map((r) => ({ key: r.id, signature: r.status })));

  return (
    <section className="panel glass panel-flush reveal" style={{ '--i': 4 } as React.CSSProperties}>
      <div className="panel-head padded">
        <h2 className="panel-title">Recent runs</h2>
        <Link href="/runs" className="link">
          View all <Icon.ChevronRight size={14} />
        </Link>
      </div>
      {runs === null && (
        <div className="padded" style={{ display: 'grid', gap: 10 }}>
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      )}
      {runs !== null && list.length === 0 && <p className="empty">No runs yet.</p>}
      <ul className="recent">
        {list.map((r) => (
          <li key={r.id} className={changed.has(r.id) ? 'flash' : ''}>
            <div className="recent-top">
              <span className="cell-strong">{TRIGGER_LABELS[r.trigger] ?? r.trigger}</span>
              <span className="cell-sub" title={fmtDate(r.startedAt)}>
                {fmtRelative(r.startedAt)}
              </span>
            </div>
            <div className="recent-body">
              <StatusBadge run={r} />
              <Outcome run={r} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
