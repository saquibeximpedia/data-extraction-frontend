'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { useCountry, useCountryStatus, useExtractability } from '@/lib/hooks';
import type { Country } from '@/lib/types';
import { fmtRelative } from '@/lib/format';
import { yearsFor } from '@/lib/months';
import { extractHref } from './CountryAction';
import { CountryStats, NextStepCard, RecentRuns, SourceInfo, UploadPanel } from './CountryPanels';
import { MonthGrid, MonthLegend } from './MonthGrid';
import { MonthEditor } from './MonthEditor';
import { PageHead } from './PageHead';
import { Badge, Button, CodeTag, Empty, Icon, LoadingPanel, Panel } from './ui';

/** Loads a country from the list and renders `children` with it, or a loading / not-found state */
export function WithCountry({ code, children }: { code: string; children: (country: Country) => React.ReactNode }) {
  const country = useCountry(code);
  if (country === undefined) return <LoadingPanel />;
  if (country === null) {
    return (
      <Panel>
        <Empty>
          There is no country {code.toUpperCase()}.{' '}
          <Link href="/" className="link">
            Back to the dashboard
          </Link>
        </Empty>
      </Panel>
    );
  }
  return <>{children(country)}</>;
}

/** A country: its next step, numbers, every year's months (editable), source and recent extractions */
export function CountryView({ country }: { country: Country }) {
  const { isAdmin } = useApp();
  const extractability = useExtractability();
  const status = useCountryStatus(country);
  const [extraYears, setExtraYears] = useState(0);
  const [editing, setEditing] = useState(false);
  const years = yearsFor(country, extraYears);

  const editMonths = () => {
    setEditing(true);
    document.getElementById('months')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <PageHead
        back={{ href: '/', label: 'Dashboard' }}
        title={
          <span className="title-with-code">
            {country.name}
            <CodeTag code={country.code} />
          </span>
        }
        sub={
          <>
            {country.kind === 'manual' && <Badge>Download-only</Badge>}{' '}
            {country.lastUpdatedAt ? `Updated ${fmtRelative(country.lastUpdatedAt)}` : 'Not updated yet'}
          </>
        }
        actions={
          <>
            {isAdmin && (
              <Link href={`/countries/${country.code}/edit`} className="btn btn-ghost btn-md">
                <Icon.Pencil size={14} /> Edit details
              </Link>
            )}
            <Link href={`/files?country=${country.code}`} className="btn btn-secondary btn-md">
              <Icon.Folder size={14} /> Files
            </Link>
            {country.kind === 'api' && (
              <Link href={extractHref(country.code, status.due)} className={`btn btn-md ${extractability(country.code).ok ? 'btn-primary' : 'btn-secondary'}`}>
                <Icon.Play size={13} /> Extract
              </Link>
            )}
          </>
        }
      />

      <CountryStats country={country} status={status} />
      <NextStepCard country={country} onEditMonths={editMonths} />

      <Panel
        id="months"
        i={3}
        className={editing ? 'panel-editing' : ''}
        title="Months"
        desc={editing ? undefined : 'Months turn extracting when an extraction starts; mark them completed once the files are checked.'}
        actions={
          editing ? (
            <Badge tone="amber" dot>Editing</Badge>
          ) : (
            <Button size="sm" variant="secondary" icon={<Icon.Pencil size={13} />} onClick={() => setEditing(true)}>
              Edit months
            </Button>
          )
        }
      >
        {editing ? (
          <MonthEditor key={country.code} country={country} years={years} onDone={() => setEditing(false)} />
        ) : (
          <MonthGrid country={country} years={years} />
        )}
        <div className="months-foot">
          {!editing && <MonthLegend />}
          <button type="button" className="text-btn" onClick={() => setExtraYears((n) => n + 1)}>
            <Icon.Plus size={12} /> Show {years[years.length - 1] - 1}
          </button>
        </div>
      </Panel>

      {country.kind === 'manual' && <UploadPanel country={country} i={4} />}

      <div className="country-bottom">
        <SourceInfo country={country} i={4} />
        {country.kind === 'api' && <RecentRuns country={country} i={5} />}
      </div>
    </>
  );
}
