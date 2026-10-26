'use client';

import { Suspense } from 'react';
import { ExtractView } from '@/components/ExtractView';

export default function ExtractPage() {
  return (
    <Suspense>
      <ExtractView />
    </Suspense>
  );
}
