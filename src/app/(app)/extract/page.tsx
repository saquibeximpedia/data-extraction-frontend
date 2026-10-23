'use client';

import { Suspense } from 'react';
import { ExtractView } from '@/components/ExtractView';
import { PageHead } from '@/components/PageHead';

export default function ExtractPage() {
  return (
    <>
      <PageHead title="Extract" sub="Pick a country, a month or date range and the trade flow, then run. Each month's file is replaced." />
      <Suspense>
        <ExtractView />
      </Suspense>
    </>
  );
}
