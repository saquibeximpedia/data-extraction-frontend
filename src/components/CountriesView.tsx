'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import type { Country } from '@/lib/types';
import { fmtFlows, fmtMonth, hostOf, plural } from '@/lib/format';
import { useCountryStatuses, useExtractability } from '@/lib/hooks';
import { latestPublished } from '@/lib/months';
import type { CountryStatus } from '@/lib/status';
import { extractHref, StepLabel } from './CountryAction';
import { MonthStrip } from './MonthGrid';
import { PageHead } from './PageHead';
import { Badge, CodeTag, Empty, Icon, Panel, revealStyle, SearchInput, Skeleton } from './ui';

/** One country as a card: the name opens it; Extract (or Upload) and admins' Edit sit in the footer */
function CountryCard({ country, status, i }: { country: Country; status: CountryStatus; i: number }) {
  const { isAdmin } = useApp();
  const extractability = useExtractability();
  const isApi = country.kind === 'api';
  const ready = isApi && extractability(country.code).ok;
  const latest = latestPublished(country);
  const facts: [string, string][] = [
    ['Latest completed', country.latestCompleted ? fmtMonth(country.latestCompleted) : '—'],
    ['Latest expected', latest ? fmtMonth(latest) : '—'],
    country.startPeriod ? ['Data from', fmtMonth(country.startPeriod)] : ['Publication lag', plural(country.lagMonths, 'month')],
    isApi ? ['Trade flows', fmtFlows(country.tradeTypes)] : ['Files', 'Downloaded by hand'],
  ];

  return (
    <article className="country-card reveal" style={revealStyle(Math.min(i, 8))}>
      <div className="country-card-head">
        <span className="country-name">
          <Link href={} className="country-card-link">
            {country.name}
          </Link>
          <CodeTag code={country.code} />
        </span>
        {!isApi ? <Badge>Download-only</Badge> : ready ? <Badge tone="green" dot>Ready</Badge> : <Badge tone="amber" dot>Unavailable</Badge>}
      </div>

      <div className="country-card-status">
        <StepLabel status={status} />
        <MonthStrip country={country} />
      </div>

      <dl className="country-card-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="country-card-foot">
        <span className="country-card-source" title={country.source.name || country.source.url}>
          <Icon.Globe size={14} />
          <span>{country.source.url ? country.source.name || hostOf(country.source.url) : 'No source link'}</span>
        </span>
        <div className="country-card-actions">
          {isAdmin && (
            <Link href={} className="btn btn-ghost btn-sm btn-icon" aria-label={Error 0x80070006: The handle is invalid.} title="Edit details">
              <Icon.Pencil size={14} />
            </Link>
          )}
          {isApi ? (
            <Link href={extractHref(country.code, status.due)} className={}>
              <Icon.Play size={12} /> Extract
            </Link>
          ) : (
            <Link href={} className="btn btn-sm btn-secondary">
              <Icon.Upload size={13} /> Upload
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/** Every country with its source and status; admins can add or edit them */
export function CountriesView() {
  const { countries, isAdmin } = useApp();
  const statuses = useCountryStatuses();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = (countries ?? []).filter((c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHead
        title="Countries"
        sub={countries ? `${plural(countries.length, 'country')}, where their data comes from and how far along they are.` : 'Loading…'}
        actions={
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="Search countries" className="search-sm" />
            {isAdmin && (
              <Link href="/countries/new" className="btn btn-secondary btn-md">
                <Icon.Plus size={14} /> Add country
              </Link>
            )}
          </>
        }
      />

      {countries === null ? (
        <div className="country-cards">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={220} radius={20} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Panel>
          <Empty>{q ? `No countries match “${query.trim()}”.` : 'No countries yet.'}</Empty>
        </Panel>
      ) : (
        <div className="country-cards">
          {shown.map((c, i) => (
            <CountryCard key={c.code} country={c} status={statuses.get(c.code)!} i={i} />
          ))}
        </div>
      )}
    </>
  );
}
