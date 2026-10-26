'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { useCountry, useCountryStatus } from '@/lib/hooks';
import type { Country } from '@/lib/types';
import { fmtRelative } from '@/lib/format';
import { yearsFor } from '@/lib/months';
import { NextAction } from './CountryAction';
import { CountryStats, NextStepCard, RecentRuns, SourceCard, UploadPanel } from './CountryPanels';
import { MonthGrid, MonthLegend } from './MonthGrid';
import { MonthPainter } from './MonthPainter';
import { PageHead } from './PageHead';
import { Badge, Button, CodeAvatar, Empty, Icon, LoadingPanel, Panel } from './ui';

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

/** A country: its next step, numbers, every year's months (paintable in edit mode), source and recent extractions */
export function CountryView({ country }: { country: Country }) {
  const { isAdmin } = useApp();
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
          <span className="title-with-avatar">
            <CodeAvatar code={country.code} muted={!country.enabled} />
            {country.name}
          </span>
        }
        sub={
          <>
            {country.kind === 'manual' && <Badge tone="blue">Download-only</Badge>} {country.code}
            {country.lastUpdatedAt ? ` · updated ${fmtRelative(country.lastUpdatedAt)}` : ''}
          </>
        }
        actions={
          <>
            {isAdmin && (
              <Link href={`/admin/countries?code=${country.code}`} className="btn btn-ghost btn-md">
                <Icon.Pencil size={14} /> Edit details
              </Link>
            )}
            {status.next.kind === 'done' && <NextAction country={country} status={status} size="md" />}
          </>
        }
      />

      <CountryStats country={country} status={status} />
      <NextStepCard country={country} onEditMonths={editMonths} />

      <div className="overview-grid">
        <div className="side-stack">
          <Panel
            id="months"
            i={3}
            className={editing ? 'panel-editing' : ''}
            title="Months"
            desc={editing ? 'Paint months with a status, then save.' : 'Months turn extracting when an extraction starts; mark them completed once the files are checked.'}
            actions={
              editing ? (
                <Badge tone="blue">Editing</Badge>
              ) : (
                <Button size="sm" variant="secondary" icon={<Icon.Pencil size={13} />} onClick={() => setEditing(true)}>
                  Edit months
                </Button>
              )
            }
          >
            {editing ? (
              <MonthPainter key={country.code} country={country} years={years} onDone={() => setEditing(false)} />
            ) : (
              <>
                <MonthGrid country={country} years={years} />
                <div className="months-card-foot">
                  <MonthLegend />
                </div>
              </>
            )}
            <button type="button" className="text-btn earlier-years" onClick={() => setExtraYears((n) => n + 1)}>
              <Icon.Plus size={12} /> Show {years[years.length - 1] - 1}
            </button>
          </Panel>

          {country.kind === 'manual' && <UploadPanel country={country} i={4} />}
        </div>

        <div className="side-stack">
          <SourceCard country={country} i={4} />
          {country.kind === 'api' && <RecentRuns country={country} i={5} />}
        </div>
      </div>
    </>
  );
}
