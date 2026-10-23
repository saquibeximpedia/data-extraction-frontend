'use client';

import { DashboardView } from '@/components/DashboardView';
import { PageHead } from '@/components/PageHead';

export default function DashboardPage() {
  return (
    <>
      <PageHead title="Dashboard" sub="Each country's latest completed month. Open a country to see all its months, or extract straight away." />
      <DashboardView />
    </>
  );
}
