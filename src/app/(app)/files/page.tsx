'use client';

import { Suspense } from 'react';
import { FilesView } from '@/components/FilesView';
import { PageHead } from '@/components/PageHead';

export default function FilesPage() {
  return (
    <>
      <PageHead title="Files" sub="Extracted files by country and month. Months over the upload limit are stored in parts." />
      <Suspense>
        <FilesView />
      </Suspense>
    </>
  );
}
