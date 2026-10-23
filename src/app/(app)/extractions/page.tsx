'use client';

import { ExtractionsList } from '@/components/ExtractionsView';
import { PageHead } from '@/components/PageHead';

export default function ExtractionsPage() {
  return (
    <>
      <PageHead title="Extractions" sub="Running and previous extractions. Logs are live only while an extraction runs; finished ones show their results." />
      <ExtractionsList />
    </>
  );
}
