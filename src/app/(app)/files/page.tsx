'use client';

import { FilesView } from '@/components/FilesView';

export default function FilesPage() {
  return (
    <>
      <div className="page-head reveal">
        <h1 className="page-title">Files</h1>
        <p className="page-sub">Extracted CSVs (one per country and month) and files uploaded for download-only countries, stored in Supabase.</p>
      </div>
      <FilesView />
    </>
  );
}
