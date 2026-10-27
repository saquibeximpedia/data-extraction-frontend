'use client';

import { useMemo } from 'react';
import type { Country, Run } from '@/lib/types';
import { useRuns } from '@/modules/service/store';
import { countryStatus, type CountryStatus } from './status';

interface CountryRow {
  country: Country;
  status: CountryStatus;
}

// Countries that need something come first: months to check, running, then the most behind
const PRIORITY = { review: 0, running: 1, due: 2, done: 3 };

/** What a country needs next, with the live service's runs on top of the ones the database has running */
export function useCountryStatus(country: Country, running: Run[]): CountryStatus {
  const runs = useRuns(running);
  return useMemo(() => countryStatus(country, runs), [country, runs]);
}

/** Every country with its status, most urgent first */
export function useCountryRows(countries: Country[], running: Run[]): CountryRow[] {
  const runs = useRuns(running);
  return useMemo(
    () =>
      countries
        .map((country) => ({ country, status: countryStatus(country, runs) }))
        .sort(
          (a, b) =>
            PRIORITY[a.status.next.kind] - PRIORITY[b.status.next.kind] || b.status.due.length - a.status.due.length || a.country.name.localeCompare(b.country.name)
        ),
    [countries, runs]
  );
}
