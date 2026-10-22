'use client';

import { Suspense } from 'react';
import { ExtractView } from '@/components/ExtractView';

export default function ExtractPage() {
  return (
    <>
      <div className="page-head reveal">
        <h1 className="page-title">Extract</h1>
        <p className="page-sub">Choose the month (or a date range), trade flow and dataset, then run. The file for each month is replaced.</p>
      </div>
      <Suspense>
        <ExtractView />
      </Suspense>
    </>
  );
}
