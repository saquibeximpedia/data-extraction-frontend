'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, CodeTag, Empty, FilterTabs, Icon, Panel, SearchInput, When } from '@/components/ui';
import { fmtMonth, plural } from '@/lib/format';
import { useRowLink } from '@/lib/hooks';
import { extractHref } from '@/lib/runs';
import type { Country, Run } from '@/lib/types';
import { useExtractability } from '@/modules/service/store';
import { useCountryRows } from '../hooks';
import { shortStep, type CountryStatus } from '../status';
import { MonthStrip } from './MonthGrid';

type Filter = 'all' | 'action' | 'done';

/** A country's status as a badge */
function StepLabel({ status }: { status: CountryStatus }) {
  const step = shortStep(status);
  return (
    <Badge tone={step.tone} dot live={status.next.kind === 'running'}>
      {step.text}
    </Badge>
  );
}

/** A country's next place to go from its row: the running extraction, the extract form with its due months filled in, or its upload form */
function NextLink({ country, status }: { country: Country; status: CountryStatus }) {
  const extractability = useExtractability();
  const { next } = status;
  const canExtract = country.kind === 'api' && extractability(country.code).ok;

  if (next.kind === 'running') {
    return (
      <Link href={`/extractions/${next.run.id}`} className="btn btn-ghost btn-sm">
        Progress <Icon.ArrowRight size={13} />
      </Link>
    );
  }
  if (country.kind === 'manual') {
    return (
      <Link href={`/countries/${country.code}#upload`} className="btn btn-ghost btn-sm">
        Upload <Icon.ArrowRight size={13} />
      </Link>
    );
  }
  return (
    <Link
      href={extractHref(country.code, next.kind === 'due' ? next.periods : [])}
      className={`btn btn-ghost btn-sm ${canExtract ? '' : 'is-disabled'}`}
      aria-disabled={!canExtract}
      title={canExtract ? undefined : 'The extraction service is offline or cannot extract this country'}
    >
      Extract <Icon.ArrowRight size={13} />
    </Link>
  );
}

/**
 * Countries in a table with search and a needs-action filter. A row opens the country; its
 * Extract / Progress / Upload link goes straight there. `limit` shows only the most urgent few
 * (a search still shows every match) with a link to the Countries page. `lead` sits on the left
 * of the head when there is no title (e.g. Add country).
 */
export function CountryTable({
  countries,
  running,
  title,
  lead,
  limit,
  i = 2,
}: {
  countries: Country[];
  running: Run[];
  title?: string;
  lead?: React.ReactNode;
  limit?: number;
  i?: number;
}) {
  const rows = useCountryRows(countries, running);
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
                  <td className="cell-muted nowrap col-updated">
                    {c.lastUpdatedAt ? <When value={c.lastUpdatedAt} as="relative" title /> : '—'}
                  </td>
                  <td className="cell-actions">
                    <div className="row-actions">
                      <NextLink country={c} status={status} />
                    </div>
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
