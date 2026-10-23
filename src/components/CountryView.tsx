'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCountry } from '@/lib/hooks';
import type { Country } from '@/lib/types';
import { fmtRange, fmtRelative, plural } from '@/lib/format';
import { yearsFor } from '@/lib/months';
import { CountryStats, RecentRuns, SourceCard, UploadPanel } from './CountryPanels';
import { ExtractLink, MonthGrid, MonthLegend } from './MonthGrid';
import { MonthPainter } from './MonthPainter';
import { PageHead } from './PageHead';
import { Badge, Button, CodeAvatar, Icon, Skeleton } from './ui';

/** Loads a country from the list and renders `children` with it, or a loading / not-found state */
export function WithCountry({ code, children }: { code: string; children: (country: Country) => React.ReactNode }) {
  const country = useCountry(code);
  if (country === undefined) {
    return (
      <section className="panel glass">
        <Skeleton height={240} />
      </section>
    );
  }
  if (country === null) {
    return (
      <section className="panel glass">
        <p className="empty">
          There is no country {code.toUpperCase()}.{' '}
          <Link href="/" className="link">
            Back to the dashboard
          </Link>
        </p>
      </section>
    );
  }
  return <>{children(country)}</>;
}

/** A country: every year's months (paintable in edit mode), its numbers, source and recent extractions */
export function CountryView({ country }: { country: Country }) {
  const [extraYears, setExtraYears] = useState(0);
  const [editing, setEditing] = useState(false);
  const years = yearsFor(country, extraYears);

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
        actions={<ExtractLink country={country} size="md" />}
      />

      <CountryStats country={country} />

      <div className="overview-grid">
        <div className="side-stack">
          <section className={`panel glass reveal ${editing ? 'panel-editing' : ''}`} style={{ '--i': 2 } as React.CSSProperties}>
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Months</h2>
                <p className="panel-desc">
                  {editing ? 'Paint months with a status, then save.' : 'Months turn extracting when an extraction starts and are marked completed by hand.'}
                </p>
              </div>
              {editing ? (
                <Badge tone="blue">Editing</Badge>
              ) : (
                <Button size="sm" variant="secondary" icon={<Icon.Pencil size={13} />} onClick={() => setEditing(true)}>
                  Edit months
                </Button>
              )}
            </div>

            {!editing && country.extractingMonths.length > 0 && (
              <div className="note note-warn note-tight">
                <Icon.Alert />
                <span>
                  {fmtRange(country.extractingMonths)} ({plural(country.extractingMonths.length, 'month')}) still extracting. Check the files, then{' '}
                  <button type="button" className="text-btn" onClick={() => setEditing(true)}>
                    mark them completed
                  </button>
                  .
                </span>
              </div>
            )}

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
          </section>

          {country.kind === 'manual' && <UploadPanel country={country} i={3} />}
        </div>

        <div className="side-stack">
          <SourceCard country={country} i={3} />
          {country.kind === 'api' && <RecentRuns country={country} i={4} />}
        </div>
      </div>
    </>
  );
}
