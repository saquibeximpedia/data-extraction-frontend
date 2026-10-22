'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExtractionDetail } from '@/components/ExtractionsView';
import { Icon } from '@/components/ui';

export default function ExtractionPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <div className="page-head reveal">
        <Link href="/extractions" className="link back-link">
          <Icon.ChevronLeft size={14} /> Extractions
        </Link>
        <h1 className="page-title">Extraction</h1>
      </div>
      <ExtractionDetail id={id} />
    </>
  );
}
