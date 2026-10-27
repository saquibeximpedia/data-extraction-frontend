'use client';

import { useApp } from '@/lib/store';
import { CountryTable, useCountryRows } from './CountryTable';
import { ServiceNotice, SetupNeeded, useSetupProblem } from './ServiceNotice';
import { Empty, Panel, Skeleton, StatTiles } from './ui';

/** Countries listed on the dashboard (most urgent first); the rest are on the Countries page */
const LIMIT = 8;

/** The dashboard: headline numbers, then every country with its status and where to go next */
export function DashboardView() {
  const { countries, runs } = useApp();
  const setupProblem = useSetupProblem();
  const rows = useCountryRows();

  const toCheck = rows.reduce((n, r) => n + r.status.review.length, 0);
  const due = rows.reduce((n, r) => n + (r.status.next.kind === 'due' ? r.status.due.length : 0), 0);
  const upToDate = rows.filter((r) => r.status.next.kind === 'done').length;
  const running = runs?.filter((r) => r.status === 'RUNNING').length ?? 0;

  return (
    <>
      <ServiceNotice impact="Extracting is unavailable until it runs; months and files still work." />

      {countries !== null && countries.length > 0 && (
        <StatTiles
          i={1}
          tiles={[
            { label: 'Up to date', value: `${upToDate} / ${rows.length}`, sub: 'countries', tone: upToDate === rows.length ? 'green' : '' },
            { label: 'To check', value: toCheck.toLocaleString(), sub: toCheck ? 'extracted months to mark completed' : 'Nothing waiting', tone: toCheck ? 'amber' : '' },
            { label: 'Due', value: due.toLocaleString(), sub: due ? 'published months not done yet' : 'Nothing due' },
            { label: 'Running now', value: running.toLocaleString(), sub: running ? 'Follow them in Extractions' : 'Idle', href: '/extractions' },
          ]}
        />
      )}

      {setupProblem && <SetupNeeded problem={setupProblem} />}

      {countries === null ? (
        <Panel i={2}>
          <div className="skeleton-rows">
            <Skeleton height={40} radius={8} />
            <Skeleton height={40} radius={8} />
            <Skeleton height={40} radius={8} />
          </div>
        </Panel>
      ) : countries.length === 0 ? (
        !setupProblem && (
          <Panel i={2}>
            <Empty>No countries yet. Start the extraction service once to publish its countries, or add a download-only country under Admin.</Empty>
          </Panel>
        )
      ) : (
        <CountryTable rows={rows} title="Countries" limit={LIMIT} />
      )}
    </>
  );
}
