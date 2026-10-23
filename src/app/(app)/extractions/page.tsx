'use client';

import { ExtractionsList } from '@/components/ExtractionsView';
import { PageHead } from '@/components/PageHead';

export default function ExtractionsPage() {
  return (
    <>
      <PageHead title="Extractions" sub="What runs on the extraction service now, and every previous extraction. Logs are live only while an extraction runs." />
      <ExtractionsList />
    </>
  );
}
