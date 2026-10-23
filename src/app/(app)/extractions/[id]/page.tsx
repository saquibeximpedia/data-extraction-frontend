'use client';

import { useParams } from 'next/navigation';
import { ExtractionDetail } from '@/components/ExtractionsView';
import { PageHead } from '@/components/PageHead';

export default function ExtractionPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <PageHead back={{ href: '/extractions', label: 'Extractions' }} title="Extraction" />
      <ExtractionDetail id={id} />
    </>
  );
}
