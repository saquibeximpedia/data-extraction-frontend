'use client';

import { Suspense } from 'react';
import { ExtractView } from '@/components/ExtractView';
import { PageHead } from '@/components/PageHead';

export default function ExtractPage() {
  return (
    <>
      <PageHead title="Extract" sub="Choose the month (or a date range), trade flow and dataset, then run. The file for each month is replaced." />
      <Suspense>
        <ExtractView />
      </Suspense>
    </>
  );
}
