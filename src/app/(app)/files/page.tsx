'use client';

import { Suspense } from 'react';
import { FilesView } from '@/components/FilesView';

export default function FilesPage() {
  return (
    <Suspense>
      <FilesView />
    </Suspense>
  );
}
