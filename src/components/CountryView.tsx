'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCountry } from '@/lib/hooks';
import type { Country } from '@/lib/types';
import { fmtMonth, fmtRange, fmtRelative, plural } from '@/lib/format';
import { yearsFor } from '@/lib/months';
import { EditMonthsLink, ExtractLink, MonthGrid, MonthLegend } from './MonthGrid';
import { PageHead } from './PageHead';
import { Icon, Skeleton } from './ui';

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

export function countrySummary(country: Country): string {
  const latest = country.latestCompleted ? `Latest completed ${fmtMonth(country.latestCompleted)}` : 'No months completed yet';
  const updated = country.lastUpdatedAt ? ` · updated ${fmtRelative(country.lastUpdatedAt)}` : '';
  return `${latest} · ${plural(country.completedMonths.length, 'month')} completed${updated}`;
}

/** A country's months, read-only. Changes are made on its edit page. */
export function CountryView({ country }: { country: Country }) {
  const [extraYears, setExtraYears] = useState(0);
  const years = yearsFor(country, extraYears);

  return (
    <>
      <PageHead
        back={{ href: '/', label: 'Dashboard' }}
        title={country.name}
        sub={countrySummary(country)}
        actions={
          <>
            <EditMonthsLink code={country.code} button />
            <ExtractLink country={country} />
          </>
        }
      />

      <section className="panel glass reveal" style={{ '--i': 1 } as React.CSSProperties}>
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Months</h2>
            <p className="panel-desc">Months start as extracting when an extraction runs, and are marked completed by hand.</p>
          </div>
          <MonthLegend />
        </div>

        {country.extractingMonths.length > 0 && (
          <div className="note note-warn">
            <Icon.Alert />
            <span>
              {fmtRange(country.extractingMonths)} ({plural(country.extractingMonths.length, 'month')}) still extracting. Check the files, then mark them completed on{' '}
              <Link href={`/countries/${country.code}/edit`} className="link">
                Edit months
              </Link>
              .
            </span>
          </div>
        )}

        <MonthGrid country={country} years={years} />
        <button type="button" className="text-btn earlier-years" onClick={() => setExtraYears((n) => n + 1)}>
          Show {years[years.length - 1] - 1}
        </button>
      </section>
    </>
  );
}
