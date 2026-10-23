'use client';

import { Suspense } from 'react';
import { FilesView } from '@/components/FilesView';
import { PageHead } from '@/components/PageHead';

export default function FilesPage() {
  return (
    <>
      <PageHead title="Files" sub="Extracted CSVs and uploaded files, by country and month. Select several to download them as one zip." />
      <Suspense>
        <FilesView />
      </Suspense>
    </>
  );
}
