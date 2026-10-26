'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import type { Country } from '@/lib/types';
import { fmtDate, fmtMonth, fmtRelative, plural } from '@/lib/format';
import { useCountryStatuses } from '@/lib/hooks';
import type { CountryStatus } from '@/lib/status';
import { describeStep, NextAction } from './CountryAction';
import { MonthStrip } from './MonthGrid';
import { PageHead } from './PageHead';
import { RunProgress } from './RunParts';
import { ServiceNotice, SetupNeeded, useSetupProblem } from './ServiceNotice';
import { Badge, CodeAvatar, Empty, Icon, Panel, Skeleton, StatTiles, StatusDot } from './ui';

type Filter = 'all' | 'action' | 'done';

const PRIORITY = { review: 0, running: 1, due: 2, done: 3 };

interface Row {
  country: Country;
  status: CountryStatus;
}

/** Countries that need something, most urgent first: months to check, running, then the most behind */
function todoRows(rows: Row[]): Row[] {
  return rows
    .filter((r) => r.status.next.kind !== 'done')
    .sort((a, b) => PRIORITY[a.status.next.kind] - PRIORITY[b.status.next.kind] || b.status.due.length - a.status.due.length || a.country.name.localeCompare(b.country.name));
}

/** The dashboard: what needs doing first, then every country at a glance */
export function DashboardView() {
  const { countries, runs } = useApp();
  const statuses = useCountryStatuses();
  const setupProblem = useSetupProblem();
  const rows = useMemo(() => (countries ?? []).map((country) => ({ country, status: statuses.get(country.code)! })).filter((r) => r.status), [countries, statuses]);
  const todo = todoRows(rows);

  const toCheck = rows.reduce((n, r) => n + r.status.review.length, 0);
  const due = rows.reduce((n, r) => n + (r.status.next.kind === 'due' ? r.status.due.length : 0), 0);
  const upToDate = rows.filter((r) => r.status.next.kind === 'done').length;
  const running = runs?.filter((r) => r.status === 'RUNNING').length ?? 0;

  const sub =
    countries === null
      ? 'Loading your countries…'
      : !countries.length
        ? setupProblem
          ? 'One setup step left before your countries appear.'
          : 'No countries yet.'
        : todo.length
          ? `${plural(todo.length, 'country')} ${todo.length === 1 ? 'needs' : 'need'} something. Start at the top of the list.`
          : 'Every country is up to date with what its source has published.';

  return (
    <>
      <PageHead title="Dashboard" sub={sub} />
      <ServiceNotice impact="Extracting is unavailable until it runs; months, uploads and files still work." />

      {countries !== null && countries.length > 0 && (
        <StatTiles
          i={1}
          tiles={[
            { label: 'Up to date', value: `${upToDate} / ${rows.length}`, sub: 'countries', tone: upToDate === rows.length ? 'green' : '' },
            { label: 'To check', value: toCheck.toLocaleString(), sub: toCheck ? 'extracted months to mark completed' : 'Nothing waiting', tone: toCheck ? 'amber' : '' },
            { label: 'Due', value: due.toLocaleString(), sub: due ? 'published months not done yet' : 'Nothing due', tone: due ? 'blue' : '' },
            { label: 'Running now', value: running.toLocaleString(), sub: running ? 'Follow them in Extractions' : 'No extractions running', href: '/extractions' },
          ]}
        />
      )}

      {setupProblem && <SetupNeeded problem={setupProblem} />}

      {countries === null ? (
        <Panel i={2}>
          <div className="skeleton-rows">
            <Skeleton height={48} radius={14} />
            <Skeleton height={48} radius={14} />
          </div>
        </Panel>
      ) : countries.length === 0 ? (
        !setupProblem && <Panel i={2}>
          <Empty>No countries yet. Start the extraction service once to publish its countries, or add a download-only country under Admin.</Empty>
        </Panel>
      ) : (
        <>
          <TodoPanel rows={todo} />
          <CountriesPanel rows={rows} />
        </>
      )}
    </>
  );
}

function TodoPanel({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return (
      <Panel i={2} className="todo-done">
        <span className="todo-done-icon">
          <Icon.Check size={18} />
        </span>
        <div>
          <h2 className="panel-title">All caught up</h2>
          <p className="panel-desc">New months show up here as soon as a source should have published them.</p>
        </div>
      </Panel>
    );
  }
  return (
    <Panel i={2} flush title="To do" desc="One step per country, most urgent first" icon={<span className="panel-icon"><Icon.Inbox size={16} /></span>}>
      <ul className="todo-list">
        {rows.map(({ country, status }) => {
          const step = describeStep(country, status);
          return (
            <li key={country.code} className={`todo-row todo-${status.next.kind}`}>
              <CodeAvatar code={country.code} muted={!country.enabled} />
              <div className="todo-text">
                <Link href={`/countries/${country.code}`} className="cell-strong row-link">
                  {country.name}
                </Link>
                <span className="todo-step">
                  <StatusDot tone={step.tone} live={status.next.kind === 'running'} /> {step.text}
                </span>
                {status.next.kind === 'running' && (
                  <div className="todo-progress">
                    <RunProgress run={status.next.run} />
                  </div>
                )}
              </div>
              <div className="todo-actions">
                {status.next.kind === 'review' && (
                  <Link href={`/files?country=${country.code}`} className="btn btn-ghost btn-sm">
                    <Icon.Folder size={14} /> Check files
                  </Link>
                )}
                <NextAction country={country} status={status} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function CountriesPanel({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const needing = rows.filter((r) => r.status.next.kind !== 'done').length;
  const shown = rows.filter(
    (r) =>
      (filter === 'all' || (filter === 'done') === (r.status.next.kind === 'done')) &&
      (!q || r.country.name.toLowerCase().includes(q) || r.country.code.toLowerCase().includes(q))
  );
  const filters: [Filter, string][] = [
    ['all', `All (${rows.length})`],
    ['action', `Needs action (${needing})`],
    ['done', `Up to date (${rows.length - needing})`],
  ];

  return (
    <Panel
      i={3}
      flush
      title="Countries"
      desc="Latest completed month and the last 12 published. Open one for every month and its source."
      actions={
        <div className="toolbar">
          {rows.length > 6 && (
            <label className="search search-sm">
              <Icon.Search size={14} />
              <input type="search" className="search-input" placeholder="Find a country" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a country" />
            </label>
          )}
          <div className="chip-group" role="group" aria-label="Filter countries">
            {filters.map(([value, label]) => (
              <button key={value} type="button" className={`chip-btn ${filter === value ? 'active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {shown.length === 0 ? (
        <Empty>No countries match.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table dashboard-table">
            <thead>
              <tr>
                <th>Country</th>
                <th style={{ width: 170 }}>Latest completed</th>
                <th className="col-strip" style={{ width: 210 }}>
                  Last 12 months
                </th>
                <th className="col-updated" style={{ width: 120 }}>
                  Last updated
                </th>
                <th className="cell-actions" style={{ width: 210 }}>
                  Next step
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ country: c, status }) => (
                <tr key={c.code} className="clickable" onClick={() => router.push(`/countries/${c.code}`)}>
                  <td>
                    <div className="country-cell">
                      <CodeAvatar code={c.code} muted={!c.enabled} />
                      <span>
                        <Link href={`/countries/${c.code}`} className="cell-strong row-link" onClick={(e) => e.stopPropagation()}>
                          {c.name}
                        </Link>
                        <span className="cell-sub row-meta">
                          {c.kind === 'manual' ? <Badge tone="blue">Download-only</Badge> : <span className="mono">{c.code}</span>}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>
                    {c.latestCompleted ? (
                      <>
                        <div className="cell-strong">{fmtMonth(c.latestCompleted)}</div>
                        <div className={`cell-sub ${status.behind ? 'text-amber' : status.behind === 0 ? 'text-green' : ''}`}>
                          {status.behind ? `${plural(status.behind, 'month')} behind` : 'Latest published'}
                        </div>
                      </>
                    ) : (
                      <span className="faint">None yet</span>
                    )}
                  </td>
                  <td className="col-strip">
                    <MonthStrip country={c} />
                  </td>
                  <td className="cell-sub-color nowrap col-updated" title={fmtDate(c.lastUpdatedAt)}>
                    {c.lastUpdatedAt ? fmtRelative(c.lastUpdatedAt) : '—'}
                  </td>
                  <td className="cell-actions nowrap">
                    <div className="row-actions">
                      <NextAction country={c} status={status} />
                      <span className="row-chevron">
                        <Icon.ChevronRight size={15} />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
