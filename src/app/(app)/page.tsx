'use client';

import { SchedulerNote } from '@/components/SchedulerNote';
import { StatsRow } from '@/components/StatsRow';
import { ExtractPanel } from '@/components/ExtractPanel';
import { RecentRuns } from '@/components/RunsView';

export default function OverviewPage() {
  return (
    <>
      <div className="page-head reveal">
        <h1 className="page-title">Overview</h1>
        <p className="page-sub">Monthly customs trade data, saved as one CSV per country and month.</p>
        <SchedulerNote />
      </div>
      <StatsRow />
      <div className="overview-grid">
        <ExtractPanel />
        <RecentRuns limit={6} />
      </div>
    </>
  );
}
