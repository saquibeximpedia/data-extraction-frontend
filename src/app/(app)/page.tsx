'use client';

import { DashboardView } from '@/components/DashboardView';

export default function DashboardPage() {
  return (
    <>
      <div className="page-head reveal">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">Months marked completed for each country. Select months to mark or remove them, or open a country to extract.</p>
      </div>
      <DashboardView />
    </>
  );
}
