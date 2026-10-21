'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApp } from '@/lib/store';
import { describeCron } from '@/lib/format';
import { Dot, Spinner, useToast } from './ui';

/** One quiet line: when the daily check runs, plus a link to run it now */
export function SchedulerNote() {
  const { health, refreshActivity } = useApp();
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  const sch = health?.scheduler;
  if (!sch) return null;

  async function runNow() {
    setStarting(true);
    try {
      await api.autoSync();
      toast('ok', 'Daily check started', 'Every enabled country is being checked for new months.');
      refreshActivity();
    } catch (err) {
      toast('err', 'Could not start the daily check', err instanceof ApiError ? err.message : 'The API server did not respond.');
    } finally {
      setStarting(false);
    }
  }

  const status = !sch.enabled ? 'Daily check is off' : sch.autoSyncRunning ? 'Daily check running now' : `Daily check runs ${describeCron(sch.cron)}`;

  return (
    <p className="schedule-note" title={sch.enabled ? `Re-checks the last ${sch.lookbackMonths} published months per country` : undefined}>
      <Dot tone={!sch.enabled ? 'neutral' : sch.autoSyncRunning ? 'blue' : 'green'} live={sch.autoSyncRunning} />
      {status}
      {!sch.autoSyncRunning && (
        <>
          <span aria-hidden="true">·</span>
          <button type="button" className="text-btn" onClick={runNow} disabled={starting}>
            {starting && <Spinner size={11} />} Run now
          </button>
        </>
      )}
    </p>
  );
}
