'use client';

import { ExtractionsList } from '@/components/ExtractionsView';

export default function ExtractionsPage() {
  return (
    <>
      <div className="page-head reveal">
        <h1 className="page-title">Extractions</h1>
        <p className="page-sub">Running and previous extractions. Open one to follow its logs.</p>
      </div>
      <ExtractionsList />
    </>
  );
}
