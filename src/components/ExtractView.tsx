'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { errorText, extractor } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Country, ExtractorInfo, TradeFlow } from '@/lib/types';
import { fmtMonth, fmtRange, plural } from '@/lib/format';
import { addMonths, latestPublished, periodRange } from '@/lib/months';
import { useExtractability } from '@/lib/hooks';
import { MonthsGlance, SourceCard } from './CountryPanels';
import { Button, CodeAvatar, Field, Icon, MonthRangePicker, Segmented, Select, Skeleton, useToast, type MonthPreset } from './ui';

type Flow = 'ALL' | TradeFlow;
type Mode = 'complete' | 'test';
type When = 'month' | 'range';

const splitCodes = (text: string) => [...new Set(text.split(/[\s,;]+/).filter(Boolean))];

/** Presets from the latest month the source should have published */
function presetsFor(country: Country, range: boolean): MonthPreset[] {
  const latest = latestPublished(country);
  if (!latest) return [];
  if (!range) {
    return [
      { label: 'Latest published', start: latest, end: latest },
      { label: 'Month before', start: addMonths(latest, -1), end: addMonths(latest, -1) },
    ];
  }
  const year = Number(latest.slice(0, 4));
  return [
    { label: 'Last 3 months', start: addMonths(latest, -2), end: latest },
    { label: 'Last 6 months', start: addMonths(latest, -5), end: latest },
    { label: 'Last 12 months', start: addMonths(latest, -11), end: latest },
    { label: `This year (${year})`, start: `${year}-01`, end: latest },
    { label: `Last year (${year - 1})`, start: `${year - 1}-01`, end: `${year - 1}-12` },
  ];
}

/** The first month after the latest completed one, or the latest published */
function nextToDo(country: Country): string {
  const latest = latestPublished(country);
  if (!country.latestCompleted) return latest;
  const next = addMonths(country.latestCompleted, 1);
  return latest && next > latest ? latest : next;
}

function ExtractForm({ country, info, countrySelect }: { country: Country; info: ExtractorInfo; countrySelect: React.ReactNode }) {
  const { service, refreshActivity } = useApp();
  const toast = useToast();
  const router = useRouter();
  const isProd = Boolean(service.health?.isProd);
  const suggested = nextToDo(country);

  const [when, setWhen] = useState<When>('month');
  const [start, setStart] = useState(suggested);
  const [end, setEnd] = useState(suggested);
  const [flow, setFlow] = useState<Flow>('ALL');
  const [mode, setMode] = useState<Mode>('complete');
  const [hsOpen, setHsOpen] = useState(false);
  const [hsText, setHsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A new country starts again from its next month to do
  useEffect(() => {
    setStart(suggested);
    setEnd(suggested);
    setFlow('ALL');
    setError('');
  }, [country.code]);

  // Back to one month keeps the first
  useEffect(() => {
    if (when === 'month') setEnd(start);
  }, [when]);

  const codes = splitCodes(hsText);
  const useCodes = hsOpen && codes.length > 0;
  const effectiveMode: Mode = isProd ? 'complete' : mode;
  const months = start && end ? periodRange(start, end) : [];
  const overlap = months.filter((p) => country.completedMonths.includes(p));
  const savedCount = effectiveMode === 'test' ? info.testHsCodeCount : info.hsCodeCount;
  const flows = flow === 'ALL' ? info.tradeTypes : [flow];

  async function run() {
    setBusy(true);
    setError('');
    try {
      const { runId } = await extractor.extract({
        countryCode: country.code,
        startDate: start,
        endDate: end,
        hsCodes: useCodes ? hsText.trim() : undefined,
        tradeType: flow,
        mode: effectiveMode,
      });
      toast('ok', 'Extraction started', `${country.name} · ${fmtRange([start, end])} marked extracting`);
      refreshActivity();
      router.push(`/extractions/${runId}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <section className="panel glass reveal" style={{ '--i': 1 } as React.CSSProperties}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">New extraction</h2>
          <p className="panel-desc">Runs on the extraction service at {service.url}. The chosen months are marked extracting.</p>
        </div>
      </div>

      <div className="extract-form">
        <Field label="Country" htmlFor="country">
          {countrySelect}
        </Field>

        <div className="field">
          <div className="field-head">
            <span className="field-label">{when === 'month' ? 'Month' : 'Date range'}</span>
          </div>
          <div className="when-row">
            <div className="when-toggle">
              <Segmented<When>
                label="One month or a range"
                value={when}
                onChange={setWhen}
                options={[
                  { value: 'month', label: 'One month' },
                  { value: 'range', label: 'Date range' },
                ]}
              />
            </div>
            <div className="when-picker">
              <MonthRangePicker
                id="months"
                single={when === 'month'}
                start={start}
                end={end}
                onChange={(s, e) => {
                  setStart(s);
                  setEnd(e);
                }}
                marked={country.completedMonths}
                markedLabel="Already completed"
                presets={presetsFor(country, when === 'range')}
              />
            </div>
          </div>
          {start && (
            <p className="field-help">
              {when === 'range' ? `${plural(months.length, 'month')}. ` : ''}
              {start === suggested && suggested !== latestPublished(country) ? 'The month after the latest completed one. ' : ''}
              {latestPublished(country) ? `${fmtMonth(latestPublished(country))} is the latest the source should have out.` : ''}
            </p>
          )}
        </div>

        <div className="extract-grid">
          <Field label="Trade flow">
            <Segmented<Flow>
              label="Trade flow"
              value={flow}
              onChange={setFlow}
              options={[
                { value: 'ALL', label: 'Both' },
                { value: 'IMPORT', label: 'Import', disabled: !info.tradeTypes.includes('IMPORT') },
                { value: 'EXPORT', label: 'Export', disabled: !info.tradeTypes.includes('EXPORT') },
              ]}
            />
          </Field>

          <Field label="Data set">
            <Segmented<Mode>
              label="Data set"
              value={effectiveMode}
              onChange={setMode}
              options={[
                { value: 'complete', label: `Complete · ${info.hsCodeCount.toLocaleString()}` },
                { value: 'test', label: `Test · ${info.testHsCodeCount.toLocaleString()}`, disabled: isProd || !info.testHsCodeCount },
              ]}
            />
          </Field>
        </div>

        <div className={`slide-panel ${hsOpen ? 'open' : ''}`}>
          <button type="button" className="slide-toggle" aria-expanded={hsOpen} onClick={() => setHsOpen((o) => !o)}>
            <span>
              <span className="cell-strong">Specific HS codes</span>
              <span className="cell-sub">{useCodes ? `${plural(codes.length, 'code')} instead of the data set` : 'Optional: extract only these codes instead of the data set'}</span>
            </span>
            <span className={`select-chevron ${hsOpen ? 'open' : ''}`}>
              <Icon.ChevronDown />
            </span>
          </button>
          <div className="slide-body" aria-hidden={!hsOpen}>
            <div className="slide-inner">
              <textarea
                rows={3}
                className="control textarea mono"
                placeholder="Paste codes separated by commas, spaces or new lines, e.g. 0901, 090111"
                value={hsText}
                onChange={(e) => setHsText(e.target.value)}
                spellCheck={false}
                tabIndex={hsOpen ? 0 : -1}
              />
              <p className="field-help">{info.hsCodeHint}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="note note-error" role="alert">
          <Icon.Alert /> <span>{error}</span>
        </div>
      )}
      {!error && overlap.length > 0 && (
        <div className="note note-warn">
          <Icon.Alert />
          <span>
            {overlap.length > 3 ? plural(overlap.length, 'month') : overlap.map(fmtMonth).join(', ')} {overlap.length === 1 ? 'is' : 'are'} already completed. Extracting again replaces{' '}
            {overlap.length === 1 ? 'its file' : 'their files'} and marks {overlap.length === 1 ? 'it' : 'them'} extracting.
          </span>
        </div>
      )}

      <div className="run-summary">
        <dl>
          <div>
            <dt>Months</dt>
            <dd>{start ? fmtRange([start, end]) : '—'}</dd>
          </div>
          <div>
            <dt>Flows</dt>
            <dd>{flows.map((f) => f.charAt(0) + f.slice(1).toLowerCase()).join(' & ')}</dd>
          </div>
          <div>
            <dt>HS codes</dt>
            <dd>{useCodes ? plural(codes.length, 'custom code') : `${savedCount.toLocaleString()} ${effectiveMode}`}</dd>
          </div>
        </dl>
        <Button variant="primary" icon={<Icon.Play />} loading={busy} disabled={!start || !end || (hsOpen && hsText.trim() !== '' && !codes.length)} onClick={run}>
          Run extraction
        </Button>
      </div>
    </section>
  );
}

/** Shown instead of the form while the service is down */
function ServiceDown() {
  const { service, checkService } = useApp();
  const [checking, setChecking] = useState(false);
  return (
    <section className="panel glass reveal offline-panel" style={{ '--i': 1 } as React.CSSProperties}>
      <span className="offline-icon">
        <Icon.Plug size={22} />
      </span>
      <h2 className="panel-title">The extraction service is offline</h2>
      <p className="panel-desc">
        Nothing answered at <span className="mono">{service.url}</span>
        {service.error ? ` (${service.error.replace(/\.$/, '')})` : ''}. Start the backend, or point this browser at the one you are running.
      </p>
      <div className="inline-form">
        <Button
          variant="secondary"
          icon={<Icon.Refresh size={14} />}
          loading={checking}
          onClick={() => {
            setChecking(true);
            checkService().finally(() => setChecking(false));
          }}
        >
          Check again
        </Button>
        <Link href="/settings" className="btn btn-primary btn-md">
          <Icon.Gear size={14} /> Change URL
        </Link>
      </div>
    </section>
  );
}

export function ExtractView() {
  const { countries, service, extractors } = useApp();
  const extractability = useExtractability();
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get('country')?.toUpperCase();

  const extractable = useMemo(() => (countries ?? []).filter((c) => c.kind === 'api'), [countries]);
  const requestedCountry = countries?.find((c) => c.code === requested);
  const country = (requestedCountry?.kind === 'api' ? requestedCountry : null) ?? extractable.find((c) => extractability(c.code).ok) ?? extractable[0];
  const info = extractors?.find((e) => e.code === country?.code);

  if (service.status === 'offline') return <ServiceDown />;
  if (!countries || service.status === 'checking' || !extractors) {
    return (
      <div className="overview-grid">
        <section className="panel glass skeleton-rows">
          <Skeleton height={24} width={160} />
          <Skeleton height={42} radius={999} />
          <Skeleton height={42} radius={999} />
          <Skeleton height={80} radius={16} />
        </section>
        <section className="panel glass">
          <Skeleton height={200} />
        </section>
      </div>
    );
  }

  if (requestedCountry?.kind === 'manual') {
    return (
      <section className="panel glass reveal">
        <p className="empty">
          {requestedCountry.name} is download-only: its files are uploaded, not extracted.{' '}
          <Link href={`/countries/${requestedCountry.code}#upload`} className="link">
            Upload files
          </Link>
        </p>
      </section>
    );
  }
  if (!country) return <p className="empty">The extraction service has no countries yet.</p>;

  // The country lives in the URL, so the dashboard can link straight to one
  const countrySelect = (
    <Select
      id="country"
      value={country.code}
      onChange={(code) => router.replace(`/extract?country=${code}`)}
      options={extractable.map((c) => {
        const status = extractability(c.code);
        const e = extractors.find((x) => x.code === c.code);
        return {
          value: c.code,
          label: c.name,
          meta: c.code,
          disabled: !status.ok,
          hint: status.ok
            ? `${c.latestCompleted ? `Latest done ${fmtMonth(c.latestCompleted)}` : 'Nothing done yet'} · ${(e?.hsCodeCount ?? 0).toLocaleString()} saved codes`
            : status.reason,
          prefix: <CodeAvatar code={c.code} muted={!status.ok} />,
        };
      })}
    />
  );

  const status = extractability(country.code);
  return (
    <div className="overview-grid">
      {info && status.ok ? (
        <ExtractForm country={country} info={info} countrySelect={countrySelect} />
      ) : (
        <section className="panel glass reveal">
          <Field label="Country" htmlFor="country">
            {countrySelect}
          </Field>
          <div className="note note-warn">
            <Icon.Alert /> <span>{status.reason}</span>
          </div>
        </section>
      )}
      <div className="side-stack">
        <MonthsGlance country={country} i={2} />
        <SourceCard country={country} i={3} />
      </div>
    </div>
  );
}
