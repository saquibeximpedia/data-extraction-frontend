'use client';

import { RunsView } from '@/components/RunsView';

export default function RunsPage() {
  return (
    <>
      <div className="page-head reveal">
        <h1 className="page-title">Runs</h1>
        <p className="page-sub">Every scheduled and manual run, newest first. Updates live while one is running.</p>
      </div>
      <RunsView />
    </>
  );
}
