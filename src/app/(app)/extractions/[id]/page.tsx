'use client';

import { useParams } from 'next/navigation';
import { ExtractionDetail } from '@/components/ExtractionsView';

export default function ExtractionPage() {
  const { id } = useParams<{ id: string }>();
  return <ExtractionDetail id={id} />;
}
