'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { errorText, extractor } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Country, ExtractorInfo, TradeFlow } from '@/lib/types';
import { fmtFlows, fmtMonth, fmtRange, plural } from '@/lib/format';
import { addMonths, dueMonths, isPeriod, latestPublished, periodRange } from '@/lib/months';
import { useExtractability } from '@/lib/hooks';
import { MonthsGlance, SourceCard } from './CountryPanels';
import { PageHead } from './PageHead';
import { ServiceDown, SetupNeeded, useSetupProblem } from './ServiceNotice';
import { Button, CodeAvatar, Empty, Field, Icon, MonthRangePicker, Panel, Segmented, Select, Skeleton, type MonthPreset } from './ui';

type Flow = 'ALL' | TradeFlow;
type Mode = 'complete' | 'test';
type When = 'month' | 'range';

const splitCodes = (text: string) => [...new Set(text.split(/[\s,;]+/).filter(Boolean))];

/** Presets from the latest month the source should have published; "catch up" covers every due month */
function presetsFor(country: Country, range: boolean): MonthPreset[] {
  const latest = latestPublished(country);
  if (!latest) return [];
  if (!range) {
    return [
      { label: 'Latest published', start: latest, end: latest },
      { label: 'Month before', start: addMonths(latest, -1), end: addMonths(latest, -1) },
    ];
  }
  const due = dueMonths(country);
  const year = Number(latest.slice(0, 4));
  return [
    ...(due.length > 1 ? [{ label: `Catch up (${plural(due.length, 'month')})`, start: due[0], end: due[due.length - 1] }] : []),
    { label: 'Last 3 months', start: addMonths(latest, -2), end: latest },
    { label: 'Last 6 months', start: addMonths(latest, -5), end: latest },
    { label: 'Last 12 months', start: addMonths(latest, -11), end: latest },
    { label: `This year (${year})`, start: `${year}-01`, end: latest },
    { label: `Last year (${year - 1})`, start: `${year - 1}-01`, end: `${year - 1}-12` },
  ];
}

/** Months to start with: the ones in the link (from the dashboard or "Run again"), else every due month, else the latest */
function initialMonths(country: Country, params: URLSearchParams): [string, string] {
  const start = params.get('start') ?? '';
  const end = params.get('end') ?? start;
  if (isPeriod(start) && isPeriod(end)) return [start, end].sort() as [string, string];
  const due = dueMonths(country);
  const latest = latestPublished(country);
  return due.length ? [due[0], due[due.length - 1]] : [latest, latest];
}

function ExtractForm({ country, info, countrySelect }: { country: Country; info: ExtractorInfo; countrySelect: React.ReactNode }) {
  const { service, refreshActivity } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const isProd = Boolean(service.health?.isProd);

  const [[start, end], setMonths] = useState(() => initialMonths(country, params));
  const [when, setWhen] = useState<When>(start === end ? 'month' : 'range');
  const [flow, setFlow] = useState<Flow>('ALL');
  const [mode, setMode] = useState<Mode>('complete');
  const [hsOpen, setHsOpen] = useState(false);
  const [hsText, setHsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A new country starts again from its own months
  useEffect(() => {
    const next = initialMonths(country, params);
    setMonths(next);
    setWhen(next[0] === next[1] ? 'month' : 'range');
    setFlow('ALL');
    setError('');
  }, [country.code]);

  const pickWhen = (value: When) => {
    setWhen(value);
    // Back to one month keeps the first
    if (value === 'month') setMonths([start, start]);
  };

  const codes = splitCodes(hsText);
  const useCodes = hsOpen && codes.length > 0;
  const effectiveMode: Mode = isProd ? 'complete' : mode;
  const months = start && end ? periodRange(start, end) : [];
  const completed = months.filter((p) => country.completedMonths.includes(p));
  const extracting = months.filter((p) => country.extractingMonths.includes(p));
  const savedCount = effectiveMode === 'test' ? info.testHsCodeCount : info.hsCodeCount;
  const flows = flow === 'ALL' ? info.tradeTypes : [flow];
  const latest = latestPublished(country);
  const unpublished = latest ? months.filter((p) => p > latest) : [];

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
      refreshActivity();
      router.push(`/extractions/${runId}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const listMonths = (periods: string[]) => (periods.length > 3 ? plural(periods.length, 'month') : periods.map(fmtMonth).join(', '));

  return (
    <Panel i={1} title="New extraction" desc={`Runs on the extraction service at ${service.url}. You can follow it live, then check and mark the months completed.`}>
      <div className="extract-form">
        <Field label="Country" htmlFor="country">
          {countrySelect}
        </Field>

        <div className="field">
          <div className="field-head">
            <span className="field-label">{when === 'month' ? 'Month' : 'Months'}</span>
          </div>
          <div className="when-row">
            <div className="when-toggle">
              <Segmented<When>
                label="One month or a range"
                value={when}
                onChange={pickWhen}
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
                onChange={(s, e) => setMonths([s, e])}
                marked={country.completedMonths}
                markedLabel="Already completed"
                presets={presetsFor(country, when === 'range')}
              />
            </div>
          </div>
          {start && (
            <p className="field-help">
              {when === 'range' ? `${plural(months.length, 'month')}. ` : ''}
              {latest ? `${fmtMonth(latest)} is the latest the source should have out.` : ''}
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
      {!error && completed.length > 0 && (
        <div className="note note-warn">
          <Icon.Alert />
          <span>
            {listMonths(completed)} {completed.length === 1 ? 'is' : 'are'} already completed. Extracting again replaces {completed.length === 1 ? 'its file' : 'their files'} and marks{' '}
            {completed.length === 1 ? 'it' : 'them'} extracting until checked again.
          </span>
        </div>
      )}
      {!error && extracting.length > 0 && (
        <div className="note note-warn">
          <Icon.Alert />
          <span>
            {listMonths(extracting)} {extracting.length === 1 ? 'was' : 'were'} extracted already and {extracting.length === 1 ? 'is' : 'are'} waiting to be checked.{' '}
            <Link href={`/countries/${country.code}`} className="link">
              Review instead
            </Link>
          </span>
        </div>
      )}
      {!error && unpublished.length > 0 && (
        <div className="note note-warn">
          <Icon.Alert />
          <span>{listMonths(unpublished)} may not be published yet, so the source can return no rows.</span>
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
            <dd>{fmtFlows(flows)}</dd>
          </div>
          <div>
            <dt>HS codes</dt>
            <dd>{useCodes ? plural(codes.length, 'custom code') : `${savedCount.toLocaleString()} ${effectiveMode}`}</dd>
          </div>
        </dl>
        <Button variant="primary" icon={<Icon.Play />} loading={busy} disabled={!start || !end || (hsOpen && hsText.trim() !== '' && !codes.length)} onClick={run}>
          Run extraction{months.length > 1 ? ` · ${plural(months.length, 'month')}` : ''}
        </Button>
      </div>
    </Panel>
  );
}

function FormSkeleton() {
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

function ExtractBody() {
  const { countries, service, extractors } = useApp();
  const extractability = useExtractability();
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get('country')?.toUpperCase();

  const extractable = useMemo(() => (countries ?? []).filter((c) => c.kind === 'api'), [countries]);
  const requestedCountry = countries?.find((c) => c.code === requested);
  const country = (requestedCountry?.kind === 'api' ? requestedCountry : null) ?? extractable.find((c) => extractability(c.code).ok) ?? extractable[0];
  const info = extractors?.find((e) => e.code === country?.code);
  const setupProblem = useSetupProblem();

  if (service.status === 'offline') return <ServiceDown />;
  if (!countries || service.status === 'checking' || !extractors) return <FormSkeleton />;

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
  if (setupProblem && !country) return <SetupNeeded problem={setupProblem} />;
  if (!country) return <Empty>The extraction service has no countries yet.</Empty>;

  // The country lives in the URL, so the dashboard can link straight to one (picking another drops the months)
  const countrySelect = (
    <Select
      id="country"
      value={country.code}
      onChange={(code) => router.replace(`/extract?country=${code}`)}
      options={extractable.map((c) => {
        const status = extractability(c.code);
        const due = dueMonths(c);
        const e = extractors.find((x) => x.code === c.code);
        return {
          value: c.code,
          label: c.name,
          meta: c.code,
          disabled: !status.ok,
          hint: status.ok
            ? `${due.length ? `${fmtRange(due)} due` : c.latestCompleted ? `Up to date (${fmtMonth(c.latestCompleted)})` : 'Nothing done yet'} · ${(e?.hsCodeCount ?? 0).toLocaleString()} saved codes`
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
        <Panel i={1}>
          <Field label="Country" htmlFor="country">
            {countrySelect}
          </Field>
          <div className="note note-warn">
            <Icon.Alert /> <span>{status.reason}</span>
          </div>
        </Panel>
      )}
      <div className="side-stack">
        <MonthsGlance country={country} i={2} />
        <SourceCard country={country} i={3} />
      </div>
    </div>
  );
}

export function ExtractView() {
  return (
    <>
      <PageHead title="Extract" sub="Pick a country, the months and the trade flow, then run. Each month's file is replaced." />
      <ExtractBody />
    </>
  );
}
