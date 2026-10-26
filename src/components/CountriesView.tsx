'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import type { Country } from '@/lib/types';
import { fmtFlows, fmtMonth, hostOf, plural } from '@/lib/format';
import { useCountryStatuses, useExtractability } from '@/lib/hooks';
import { latestPublished } from '@/lib/months';
import type { CountryStatus } from '@/lib/status';
import { StepLabel } from './CountryAction';
import { MonthStrip } from './MonthGrid';
import { PageHead } from './PageHead';
import { Badge, CodeTag, Empty, Icon, Panel, revealStyle, SearchInput, Skeleton } from './ui';

/** One country as a card: the whole card opens it; admins also get Edit */
function CountryCard({ country, status, i }: { country: Country; status: CountryStatus; i: number }) {
  const { isAdmin } = useApp();
  const extractability = useExtractability();
  const ready = country.kind === 'api' && extractability(country.code).ok;
  const latest = latestPublished(country);

  return (
    <article className="country-card reveal" style={revealStyle(Math.min(i, 8))}>
      <div className="country-card-head">
        <span className="country-name">
          <Link href={`/countries/${country.code}`} className="country-card-link">
            {country.name}
          </Link>
          <CodeTag code={country.code} />
        </span>
        {isAdmin && (
          <Link href={`/countries/${country.code}/edit`} className="btn btn-ghost btn-sm country-card-edit">
            <Icon.Pencil size={14} /> Edit
          </Link>
        )}
      </div>

      <div className="country-card-status">
        <StepLabel status={status} />
        <MonthStrip country={country} />
      </div>

      <dl className="country-card-facts">
        <div>
          <dt>Latest completed</dt>
          <dd>{country.latestCompleted ? fmtMonth(country.latestCompleted) : '—'}</dd>
        </div>
        <div>
          <dt>Latest expected</dt>
          <dd>{latest ? fmtMonth(latest) : '—'}</dd>
        </div>
        <div>
          <dt>Publication lag</dt>
          <dd>{plural(country.lagMonths, 'month')}</dd>
        </div>
        <div>
          <dt>{country.kind === 'api' ? 'Trade flows' : 'Files'}</dt>
          <dd>{country.kind === 'api' ? fmtFlows(country.tradeTypes) : 'Downloaded by hand'}</dd>
        </div>
      </dl>

      <div className="country-card-foot">
        <span className="country-card-source">
          <Icon.Globe size={14} /> {country.source.url ? country.source.name || hostOf(country.source.url) : 'No source link'}
        </span>
        {country.kind === 'manual' ? <Badge>Download-only</Badge> : ready ? <Badge tone="green" dot>Ready</Badge> : <Badge dot>Extractor unavailable</Badge>}
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
