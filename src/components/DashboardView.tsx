'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import type { Country } from '@/lib/types';
import { fmtDate, fmtMonth, fmtRelative, plural } from '@/lib/format';
import { useCountryStatuses } from '@/lib/hooks';
import type { CountryStatus } from '@/lib/status';
import { CountryLinks, StepLabel } from './CountryAction';
import { MonthStrip } from './MonthGrid';
import { PageHead } from './PageHead';
import { ServiceNotice, SetupNeeded, useSetupProblem } from './ServiceNotice';
import { Badge, CodeTag, Empty, FilterTabs, Panel, SearchInput, Skeleton, StatTiles } from './ui';

type Filter = 'all' | 'action' | 'done';

// Countries that need something come first: months to check, running, then the most behind
const PRIORITY = { review: 0, running: 1, due: 2, done: 3 };

interface Row {
  country: Country;
  status: CountryStatus;
}

/** The dashboard: headline numbers, then every country with its status and where to go next */
export function DashboardView() {
  const { countries, runs } = useApp();
  const statuses = useCountryStatuses();
  const setupProblem = useSetupProblem();
  const rows = useMemo(
    () =>
      (countries ?? [])
        .map((country) => ({ country, status: statuses.get(country.code)! }))
        .filter((r) => r.status)
        .sort(
          (a, b) =>
            PRIORITY[a.status.next.kind] - PRIORITY[b.status.next.kind] || b.status.due.length - a.status.due.length || a.country.name.localeCompare(b.country.name)
        ),
    [countries, statuses]
  );

  const toCheck = rows.reduce((n, r) => n + r.status.review.length, 0);
  const due = rows.reduce((n, r) => n + (r.status.next.kind === 'due' ? r.status.due.length : 0), 0);
  const upToDate = rows.filter((r) => r.status.next.kind === 'done').length;
  const running = runs?.filter((r) => r.status === 'RUNNING').length ?? 0;
  const needing = rows.length - upToDate;

  const sub =
    countries === null
      ? 'Loading your countries…'
      : !countries.length
        ? setupProblem
          ? 'One setup step left before your countries appear.'
          : 'No countries yet.'
        : needing
          ? `${needing === 1 ? '1 country needs' : `${needing} countries need`} something; they are listed first.`
          : 'Every country is up to date with what its source has published.';

  return (
    <>
      <PageHead title="Dashboard" sub={sub} />
      <ServiceNotice impact="Extracting is unavailable until it runs; months and files still work." />

      {countries !== null && countries.length > 0 && (
        <StatTiles
          i={1}
          tiles={[
            { label: 'Up to date', value: `${upToDate} / ${rows.length}`, sub: 'countries', tone: upToDate === rows.length ? 'green' : '' },
            { label: 'To check', value: toCheck.toLocaleString(), sub: toCheck ? 'extracted months to mark completed' : 'Nothing waiting', tone: toCheck ? 'amber' : '' },
            { label: 'Due', value: due.toLocaleString(), sub: due ? 'published months not done yet' : 'Nothing due' },
            { label: 'Running now', value: running.toLocaleString(), sub: running ? 'Follow them in Extractions' : 'Idle', href: '/extractions' },
          ]}
        />
      )}

      {setupProblem && <SetupNeeded problem={setupProblem} />}

      {countries === null ? (
        <Panel i={2}>
          <div className="skeleton-rows">
            <Skeleton height={40} radius={8} />
            <Skeleton height={40} radius={8} />
            <Skeleton height={40} radius={8} />
          </div>
        </Panel>
      ) : countries.length === 0 ? (
        !setupProblem && (
          <Panel i={2}>
            <Empty>No countries yet. Start the extraction service once to publish its countries, or add a download-only country under Admin.</Empty>
          </Panel>
        )
      ) : (
        <CountriesPanel rows={rows} needing={needing} />
      )}
    </>
  );
}

function CountriesPanel({ rows, needing }: { rows: Row[]; needing: number }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (filter === 'all' || (filter === 'done') === (r.status.next.kind === 'done')) &&
      (!q || r.country.name.toLowerCase().includes(q) || r.country.code.toLowerCase().includes(q))
  );

  return (
    <Panel
      i={2}
      flush
      title="Countries"
      actions={
        <div className="toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Search countries" className="search-sm" />
          <FilterTabs<Filter>
            label="Filter countries"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: rows.length },
              { value: 'action', label: 'Needs action', count: needing },
              { value: 'done', label: 'Up to date', count: rows.length - needing },
            ]}
          />
        </div>
      }
    >
      {shown.length === 0 ? (
        <Empty>{q ? `No countries match “${query.trim()}”.` : 'No countries in this filter.'}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Country</th>
                <th style={{ width: 200 }}>Status</th>
                <th style={{ width: 160 }}>Latest completed</th>
                <th className="col-strip" style={{ width: 150 }}>
                  Last 12 months
                </th>
                <th className="col-updated" style={{ width: 120 }}>
                  Updated
                </th>
                <th style={{ width: 130 }}>
                  <span className="sr-only">Go to</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ country: c, status }) => (
                <tr key={c.code}>
                  <td>
                    <span className="country-name">
                      <Link href={`/countries/${c.code}`} className="cell-strong row-link">
                        {c.name}
                      </Link>
                      <CodeTag code={c.code} />
                      {c.kind === 'manual' && <Badge>Download-only</Badge>}
                    </span>
                  </td>
                  <td>
                    <StepLabel status={status} />
                  </td>
                  <td>
                    {c.latestCompleted ? (
                      <>
                        <div>{fmtMonth(c.latestCompleted)}</div>
                        <div className={`cell-sub ${status.behind ? 'text-amber' : ''}`}>{status.behind ? `${plural(status.behind, 'month')} behind` : 'Latest published'}</div>
                      </>
                    ) : (
                      <span className="faint">None yet</span>
                    )}
                  </td>
                  <td className="col-strip">
                    <MonthStrip country={c} />
                  </td>
                  <td className="cell-muted nowrap col-updated" title={fmtDate(c.lastUpdatedAt)}>
                    {c.lastUpdatedAt ? fmtRelative(c.lastUpdatedAt) : '—'}
                  </td>
                  <td className="cell-actions">
                    <CountryLinks country={c} status={status} />
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
