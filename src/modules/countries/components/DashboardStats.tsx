'use client';

import { StatTiles } from '@/components/ui';
import type { Country, Run } from '@/lib/types';
import { useApp } from '@/modules/service/store';
import { useCountryRows } from '../hooks';
import { fmtNumber } from '@/lib/format';

/** The dashboard's headline numbers across every country */
export function DashboardStats({ countries, running }: { countries: Country[]; running: Run[] }) {
  const { liveRuns } = useApp();
  const rows = useCountryRows(countries, running);
  const toCheck = rows.reduce((n, r) => n + r.status.review.length, 0);
  const due = rows.reduce((n, r) => n + (r.status.next.kind === 'due' ? r.status.due.length : 0), 0);
  const upToDate = rows.filter((r) => r.status.next.kind === 'done').length;
  const runningNow = liveRuns.length;

  return (
    <StatTiles
      i={1}
      tiles={[
        { label: 'Up to date', value: `${upToDate} / ${rows.length}`, sub: 'countries', tone: upToDate === rows.length ? 'green' : '' },
        { label: 'To check', value: fmtNumber(toCheck), sub: toCheck ? 'extracted months to mark completed' : 'Nothing waiting', tone: toCheck ? 'amber' : '' },
        { label: 'Due', value: fmtNumber(due), sub: due ? 'published months not done yet' : 'Nothing due' },
        { label: 'Running now', value: fmtNumber(runningNow), sub: runningNow ? 'Follow them in Extractions' : 'Idle', href: '/extractions' },
      ]}
    />
  );
}
