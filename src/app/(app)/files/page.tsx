'use client';

import { FilesView } from '@/components/FilesView';

export default function FilesPage() {
  return (
    <>
      <div className="page-head reveal">
        <h1 className="page-title">Files</h1>
        <p className="page-sub">One CSV per country and month, containing every HS code extracted for it.</p>
      </div>
      <FilesView />
    </>
  );
}
