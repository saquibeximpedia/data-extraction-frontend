'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import type { Country } from '@/lib/types';
import { fmtDate, fmtMonth, fmtRelative, plural } from '@/lib/format';
import { useCountryStatuses, useRowLink } from '@/lib/hooks';
import type { CountryStatus } from '@/lib/status';
import { CountryLinks, StepLabel } from './CountryAction';
import { MonthStrip } from './MonthGrid';
import { Badge, CodeTag, Empty, FilterTabs, Icon, Panel, SearchInput } from './ui';

type Filter = 'all' | 'action' | 'done';

// Countries that need something come first: months to check, running, then the most behind
const PRIORITY = { review: 0, running: 1, due: 2, done: 3 };

export interface CountryRow {
  country: Country;
  status: CountryStatus;
}

/** Every country with its status, most urgent first */
export function useCountryRows(): CountryRow[] {
  const { countries } = useApp();
  const statuses = useCountryStatuses();
  return useMemo(
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
}

/**
 * Countries in a table with search and a needs-action filter. A row opens the country; its
 * Extract / Progress / Upload link goes straight there. `limit` shows only the most urgent few
 * (a search still shows every match) with a link to the Countries page.
 */
/** `lead` sits on the left of the head when there is no title (e.g. Add country) */
export function CountryTable({ rows, title, lead, limit, i = 2 }: { rows: CountryRow[]; title?: string; lead?: React.ReactNode; limit?: number; i?: number }) {
  const rowLink = useRowLink();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const needing = rows.filter((r) => r.status.next.kind !== 'done').length;
  const shown = rows.filter(
    (r) =>
      (filter === 'all' || (filter === 'done') === (r.status.next.kind === 'done')) &&
      (!q || r.country.name.toLowerCase().includes(q) || r.country.code.toLowerCase().includes(q))
  );
  const visible = q || !limit ? shown : shown.slice(0, limit);

  return (
    <Panel
      i={i}
      flush
      title={title}
      icon={lead || undefined}
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
              {visible.map(({ country: c, status }) => (
                <tr key={c.code} {...rowLink(`/countries/${c.code}`)}>
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
      {limit !== undefined && rows.length > limit && (
        <div className="panel-more">
          <Link href="/countries" className="btn btn-ghost btn-sm">
            {visible.length < shown.length ? `See all ${plural(rows.length, 'country')}` : 'All countries'} <Icon.ChevronRight size={13} />
          </Link>
        </div>
      )}
    </Panel>
  );
}
