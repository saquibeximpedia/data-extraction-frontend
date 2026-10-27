'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { Button, Icon, Panel, StatusDot, useToast } from './ui';

/**
 * A banner while the extraction service is down, saying what that affects (`impact`).
 * Renders nothing while it is live or being checked.
 */
export function ServiceNotice({ impact }: { impact: React.ReactNode }) {
  const { service } = useApp();
  if (service.status !== 'offline') return null;
  return (
    <div className="service-note reveal">
      <StatusDot tone="red" />
      <span>
        <b>The extraction service is offline</b> at <span className="mono">{service.url}</span>. {impact}
      </span>
      <RecheckButton size="sm" />
      <Link href="/service" className="btn btn-ghost btn-sm">
        <Icon.Plug size={13} /> Connection
      </Link>
    </div>
  );
}

/** Checks the service again now, instead of waiting for the next 15-second check */
function RecheckButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { checkService } = useApp();
  const [checking, setChecking] = useState(false);
  return (
    <Button
      size={size}
      variant="secondary"
      icon={<Icon.Refresh size={13} />}
      loading={checking}
      onClick={() => {
        setChecking(true);
        checkService().finally(() => setChecking(false));
      }}
    >
      Check again
    </Button>
  );
}

const COLUMNS_FIX = `alter table country_config add column if not exists extractor jsonb;
alter table country_config add column if not exists extractor_synced_at timestamptz;
notify pgrst, 'reload schema';`;

/**
 * Why there are no countries to extract, when the cause is setup: the service runs but its database
 * isn't ready (it publishes its countries there), or it has extractors the database doesn't list yet.
 * Null when that is not the case.
 */
export function useSetupProblem(): string | null {
  const { service, serviceLive, extractors, countries } = useApp();
  if (!serviceLive) return null;
  const database = service.health?.database;
  if (database && !database.ok) return database.error || 'The database is not set up yet.';
  const apiCountries = countries?.filter((c) => c.kind === 'api').length ?? 0;
  if (countries && extractors?.length && apiCountries === 0) return 'The extraction service has countries, but has not published them to the database yet.';
  return null;
}

/** Steps to finish setting up the database, with the SQL to copy; replaces the empty "no countries" state */
export function SetupNeeded({ problem }: { problem: string }) {
  const { checkService, refreshCountries, extractors } = useApp();
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const missingColumns = /column .*extractor/i.test(problem);
  const sql = missingColumns ? COLUMNS_FIX : '-- Paste the whole of backend/supabase/schema.sql (safe to run again)';

  return (
    <Panel i={1} className="setup-panel" icon={<span className="offline-icon setup-icon"><Icon.Alert size={20} /></span>} title="Finish setting up the database" desc="The extraction service is running, but its countries can't reach the dashboard until the database has the latest tables.">
      <div className="note note-warn note-tight">
        <Icon.Alert />
        <span className="mono">{problem}</span>
      </div>
      <ol className="setup-steps">
        <li>
          Open your Supabase project → <b>SQL editor</b>.
        </li>
        <li>
          Run {missingColumns ? 'this' : <span className="mono">backend/supabase/schema.sql</span>}
          {missingColumns ? ' (or the whole of backend/supabase/schema.sql; both are safe to run again)' : ''}:
          <pre className="setup-sql mono">{sql}</pre>
          <Button size="sm" variant="secondary" icon={<Icon.Copy size={13} />} onClick={() => navigator.clipboard?.writeText(sql).then(() => toast('ok', 'SQL copied'))}>
            Copy SQL
          </Button>
        </li>
        <li>
          Wait up to a minute: the service retries by itself and publishes {extractors?.length ? `its ${extractors.length} countries (${extractors.map((e) => e.code).join(', ')})` : 'its countries'}. No restart needed.
        </li>
      </ol>
      <div className="panel-foot">
        <span className="foot-summary">This page updates on its own once the countries arrive.</span>
        <Button
          variant="primary"
          icon={<Icon.Refresh size={14} />}
          loading={checking}
          onClick={() => {
            setChecking(true);
            Promise.all([checkService(), refreshCountries()]).finally(() => setChecking(false));
          }}
        >
          Check now
        </Button>
      </div>
    </Panel>
  );
}

/** Shown instead of something that needs the service, while it is down */
export function ServiceDown() {
  const { service } = useApp();
  return (
    <Panel i={1} className="offline-panel">
      <span className="offline-icon">
        <Icon.Plug size={22} />
      </span>
      <h2 className="panel-title">The extraction service is offline</h2>
      <p className="panel-desc">
        Nothing answered at <span className="mono">{service.url}</span>
        {service.error ? ` (${service.error.replace(/\.$/, '')})` : ''}. Start the backend, or point this browser at the one you are running. Months and files keep working meanwhile.
      </p>
      <div className="inline-form">
        <RecheckButton />
        <Link href="/service" className="btn btn-primary btn-md">
          <Icon.Gear size={14} /> Change URL
        </Link>
      </div>
    </Panel>
  );
}
