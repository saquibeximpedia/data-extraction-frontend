'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProgress } from '@/components/run-progress';
import { ServiceNotice } from '@/components/service-notice';
import { Badge, Button, Empty, FilterTabs, Icon, Panel, ProgressBar, revealStyle, When } from '@/components/ui';
import { fmtMs, fmtNumber, plural } from '@/lib/format';
import { useChangedKeys, useRowLink } from '@/lib/hooks';
import { describeRun, fmtRecords, isRunning, needsAttention, runNotes, timeTaken } from '@/lib/runs';
import type { Run } from '@/lib/types';
import { useApp, useRuns } from '@/modules/service/store';
import { Elapsed, RunBar, RunStatusBadge, StopButton } from './RunParts';

type Filter = 'all' | 'attention';

function ExtractionRow({ run, flash }: { run: Run; flash: boolean }) {
  const rowLink = useRowLink()(`/extractions/${run.id}`);
  const notes = runNotes(run);

  return (
    <tr {...rowLink} className={`${rowLink.className} ${flash ? 'flash' : ''}`}>
      <td className="nowrap">
        <div className="cell-strong">
          <When value={run.startedAt} as="time" title />
        </div>
        <div className="cell-sub">
          <When value={run.startedAt} as="day" />
        </div>
      </td>
      <td>
        <Link href={`/extractions/${run.id}`} className="cell-strong row-link">
          {describeRun(run)}
        </Link>
        <div className="cell-sub row-meta">
          <RunStatusBadge run={run} />
          {notes.length > 0 && (
            <Badge tone={notes.some((n) => n.tone === 'red') ? 'red' : 'amber'} dot>
              {plural(notes.length, 'flag')}
            </Badge>
          )}
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
          <b>{p.pct}%</b> · {fmtNumber(p.finished)} / {fmtNumber(p.total)} requests
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

/** Extractions running on the service right now, with their progress */
function LiveSection() {
  const { liveRuns, serviceLive } = useApp();
  if (!serviceLive) return null;

  return (
    <section className="live-section reveal" style={revealStyle(1)} aria-label="Running now">
      <div className="section-head">
        <h2 className="section-title">
          Running now
          {liveRuns.length ? (
            <Badge tone="green" live>
              {liveRuns.length} running
            </Badge>
          ) : (
            <Badge dot>Idle</Badge>
          )}
        </h2>
        <Link href="/extract" className="btn btn-primary btn-sm">
          <Icon.Play size={12} /> New extraction
        </Link>
      </div>
      {liveRuns.length === 0 ? (
        <p className="live-empty">Nothing is running on the extraction service. New extractions show up here with live progress.</p>
      ) : (
        <div className="live-cards">
          {liveRuns.map((r) => (
            <LiveCard key={r.id} run={r} />
          ))}
        </div>
      )}
    </section>
  );
}

/** What runs now (from the service), then the history (from the database) */
export function ExtractionsList({ history }: { history: Run[] }) {
  const { serviceLive } = useApp();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const runs = useRuns(history);
  const [filter, setFilter] = useState<Filter>('all');
  // While the service is live, its running extractions have their own section above
  const list = runs.filter((r) => !(serviceLive && isRunning(r)));
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
        desc={`${list.length} most recent`}
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
            <Button variant="secondary" size="sm" icon={<Icon.Refresh size={14} />} loading={refreshing} onClick={() => startRefresh(() => router.refresh())}>
              Refresh
            </Button>
          </div>
        }
      >
        {shown.length === 0 ? (
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
