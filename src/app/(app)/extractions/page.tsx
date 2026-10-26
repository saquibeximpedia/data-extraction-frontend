'use client';

import { ExtractionsList } from '@/components/ExtractionsView';
import { PageHead } from '@/components/PageHead';

export default function ExtractionsPage() {
  return (
    <>
      <PageHead title="Extractions" sub="What runs on the extraction service now, and every previous extraction. Open one for live logs while it runs, or its results and next step after." />
      <ExtractionsList />
    </>
  );
}
