'use client';

import Link from 'next/link';
import { useApp } from '@/lib/store';
import { CountryTable, useCountryRows } from './CountryTable';
import { CountriesSkeleton } from './PageSkeletons';
import { Empty, Icon, Panel } from './ui';

/** Every country in the same table as the dashboard, without the limit. Admins can add countries. */
export function CountriesView() {
  const { countries, isAdmin } = useApp();
  const rows = useCountryRows();

  return (
    <>
      {countries === null ? (
        <CountriesSkeleton />
      ) : countries.length === 0 ? (
        <Panel i={1}>
          <Empty>No countries yet.</Empty>
        </Panel>
      ) : (
        <CountryTable
          rows={rows}
          i={1}
          lead={
            isAdmin && (
              <Link href="/countries/new" className="btn btn-secondary btn-sm">
                <Icon.Plus size={14} /> Add country
              </Link>
            )
          }
        />
      )}
    </>
  );
}
