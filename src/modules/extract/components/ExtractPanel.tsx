'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MonthLegend, STATE_LABEL } from '@/components/months';
import { RecheckButton, SetupNeeded, useSetupProblem } from '@/components/service-notice';
import { ExtractSkeleton } from '@/components/skeletons';
import { SourceInfo } from '@/components/source-info';
import { Empty, Icon, Panel, Select } from '@/components/ui';
import { fmtMonth, fmtRange } from '@/lib/format';
import { MONTH_LABELS, dueMonths, monthState } from '@/lib/months';
import type { Country } from '@/lib/types';
import { useApp, useExtractability } from '@/modules/service/store';
import { ExtractForm, FormHead, type RequestedMonths } from './ExtractForm';

/** Shown instead of the form while the service is down */
function ServiceDown() {
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

/** The chosen country's last 12 published months with their names: the context for picking months */
function RecentMonths({ country }: { country: Country }) {
  const periods = country.recentPeriods.slice(-12);
  return (
    <Panel
      i={2}
      title="Last 12 months"
      desc={periods.length ? `${country.name} · ${fmtRange(periods)}` : country.name}
      actions={
        <Link href={`/countries/${country.code}`} className="link link-quiet">
          All months <Icon.ChevronRight size={12} />
        </Link>
      }
    >
      <div className="recent-months" role="group" aria-label={`${country.name}, ${fmtRange(periods)}`}>
        {periods.map((p) => {
          const state = monthState(country, p);
          const month = MONTH_LABELS[Number(p.slice(5, 7)) - 1];
          return (
            <span key={p} className={`recent-month state-${state} ${month === 'Jan' ? 'new-year' : ''}`} title={`${fmtMonth(p)} · ${STATE_LABEL[state]}`}>
              {month}
            </span>
          );
        })}
      </div>
      <div className="months-foot">
        <MonthLegend />
        <span className="foot-summary">{country.latestCompleted ? `Latest completed ${fmtMonth(country.latestCompleted)}` : 'Nothing completed yet'}</span>
      </div>
    </Panel>
  );
}

/**
 * The extract form for the country in the link (else the first one the service can extract),
 * beside its recent months. Picking another country changes the link and drops the months.
 */
export function ExtractPanel({ countries, requested }: { countries: Country[]; requested: RequestedMonths & { country?: string } }) {
  const { service, extractors } = useApp();
  const extractability = useExtractability();
  const router = useRouter();
  const setupProblem = useSetupProblem(countries);
  const code = requested.country?.toUpperCase();

  const extractable = countries.filter((c) => c.kind === 'api');
  const requestedCountry = countries.find((c) => c.code === code);
  const country = (requestedCountry?.kind === 'api' ? requestedCountry : null) ?? extractable.find((c) => extractability(c.code).ok) ?? extractable[0];
  const info = extractors?.find((e) => e.code === country?.code);

  if (service.status === 'offline') return <ServiceDown />;
  if (service.status === 'checking' || !extractors) return <ExtractSkeleton />;

  if (requestedCountry?.kind === 'manual') {
    return (
      <Panel>
        <Empty>
          {requestedCountry.name} is download-only: its files are uploaded, not extracted.{' '}
          <Link href={`/countries/${requestedCountry.code}#upload`} className="link">
            Upload files
          </Link>
        </Empty>
      </Panel>
    );
  }
  if (!country) return setupProblem ? <SetupNeeded problem={setupProblem} /> : <Empty>The extraction service has no countries yet.</Empty>;

  const countrySelect = (
    <Select
      id="country"
      value={country.code}
      onChange={(next) => router.replace(`/extract?country=${next}`)}
      options={extractable.map((c) => {
        const status = extractability(c.code);
        const due = dueMonths(c);
        return {
          value: c.code,
          label: c.name,
          meta: c.code,
          disabled: !status.ok,
          hint: status.ok ? (due.length ? `${fmtRange(due)} due` : c.latestCompleted ? `Up to date (${fmtMonth(c.latestCompleted)})` : 'Nothing done yet') : status.reason,
        };
      })}
    />
  );

  const status = extractability(country.code);
  return (
    <div className="extract-layout">
      <div className="extract-main">
        {info && status.ok ? (
          <ExtractForm key={country.code} country={country} info={info} requested={country.code === code ? requested : {}} countrySelect={countrySelect} />
        ) : (
          <Panel i={1} className="extract-card">
            <FormHead countrySelect={countrySelect} />
            <div className="note note-warn">
              <Icon.Alert /> <span>{status.reason}</span>
            </div>
          </Panel>
        )}
        <SourceInfo country={country} i={3} />
      </div>
      <aside className="extract-aside">
        <RecentMonths country={country} />
      </aside>
    </div>
  );
}
