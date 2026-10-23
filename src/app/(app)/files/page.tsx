'use client';

import { FilesView } from '@/components/FilesView';
import { PageHead } from '@/components/PageHead';

export default function FilesPage() {
  return (
    <>
      <PageHead title="Files" sub="Extracted CSVs (one per country and month) and files uploaded for download-only countries, by country, year and month." />
      <FilesView />
    </>
  );
}
