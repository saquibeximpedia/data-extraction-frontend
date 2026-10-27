'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { errorText, extractor } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { AppSettings, Country, ExtractorInfo, RunOptions, TradeFlow } from '@/lib/types';
import { fmtFlows, fmtMonth, fmtRange, plural } from '@/lib/format';
import { addMonths, dueMonths, isPeriod, latestPublished, periodRange } from '@/lib/months';
import { useExtractability } from '@/lib/hooks';
import { SourceInfo } from './CountryPanels';
import { MonthLegend, RecentMonths } from './MonthGrid';
import { ServiceDown, SetupNeeded, useSetupProblem } from './ServiceNotice';
import { ExtractSkeleton } from './PageSkeletons';
import { Button, Empty, Field, Icon, MonthRangePicker, NumberInput, Panel, Segmented, Select, type MonthPreset } from './ui';

type Flow = 'ALL' | TradeFlow;
type Mode = 'complete' | 'test';
type When = 'month' | 'range';

const splitCodes = (text: string) => [...new Set(text.split(/[\s,;]+/).filter(Boolean))];

/** Presets from the latest month the source should have published; "catch up" covers every due month. None start before the start month. */
function presetsFor(country: Country, range: boolean): MonthPreset[] {
  const latest = latestPublished(country);
  if (!latest) return [];
  const from = country.startPeriod;
  const clamp = (p: MonthPreset): MonthPreset => (from && p.start < from && p.end >= from ? { ...p, start: from } : p);
  if (!range) {
    return [
      { label: 'Latest published', start: latest, end: latest },
      { label: 'Month before', start: addMonths(latest, -1), end: addMonths(latest, -1) },
    ];
  }
  const due = dueMonths(country);
  const year = Number(latest.slice(0, 4));
  const presets: MonthPreset[] = [
    ...(due.length > 1 ? [{ label: `Catch up (${plural(due.length, 'month')})`, start: due[0], end: due[due.length - 1] }] : []),
    { label: 'Last 3 months', start: addMonths(latest, -2), end: latest },
    { label: 'Last 6 months', start: addMonths(latest, -5), end: latest },
    { label: 'Last 12 months', start: addMonths(latest, -11), end: latest },
    { label: `This year (${year})`, start: `${year}-01`, end: latest },
    { label: `Last year (${year - 1})`, start: `${year - 1}-01`, end: `${year - 1}-12` },
  ];
  return presets.map(clamp);
}

/** Months to start with: the ones in the link (from the dashboard or "Run again"), else every due month, else the latest */
function initialMonths(country: Country, params: URLSearchParams): [string, string] {
  const start = params.get('start') ?? '';
  const end = params.get('end') ?? start;
  if (isPeriod(start) && isPeriod(end)) {
    const [lo, hi] = [start, end].sort();
    const from = country.startPeriod;
    return from && lo < from && hi >= from ? [from, hi] : [lo, hi];
  }
  const due = dueMonths(country);
  const latest = latestPublished(country);
  return due.length ? [due[0], due[due.length - 1]] : [latest, latest];
}

/** Per-run tuning fields; empty ones keep the default shown as the placeholder */
type Tuning = Record<keyof RunOptions, string>;
const NO_TUNING: Tuning = { concurrency: '', rateLimitPerMinute: '', retryMaxAttempts: '', retryDelayMs: '' };

/** The extraction service's settings, for the defaults the tuning fields show (null: not loaded, or an older service) */
function useServiceSettings(): AppSettings | null {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  useEffect(() => {
    extractor.settings().then((r) => setSettings(r.settings), () => setSettings(null));
  }, []);
  return settings;
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
  const [tuneOpen, setTuneOpen] = useState(false);
  const [tuning, setTuning] = useState<Tuning>(NO_TUNING);
  const settings = useServiceSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A new country starts again from its own months
  useEffect(() => {
    const next = initialMonths(country, params);
    setMonths(next);
    setWhen(next[0] === next[1] ? 'month' : 'range');
    setFlow('ALL');
    setTuning(NO_TUNING);
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
  const beforeStart = country.startPeriod ? months.filter((p) => p < country.startPeriod!) : [];

  // Defaults when a field is left empty: the source's own limits, else the service's settings
  const tuningDefaults: Tuning = {
    concurrency: String(info.concurrency ?? settings?.maxConcurrentPerCountry ?? ''),
    rateLimitPerMinute: String(info.rateLimitPerMinute ?? 60),
    retryMaxAttempts: String(settings?.retryMaxAttempts ?? ''),
    retryDelayMs: settings ? String(settings.retryDelayMs / 1000) : '',
  };
  const options: RunOptions = {
    concurrency: tuning.concurrency ? Number(tuning.concurrency) : undefined,
    rateLimitPerMinute: tuning.rateLimitPerMinute ? Number(tuning.rateLimitPerMinute) : undefined,
    retryMaxAttempts: tuning.retryMaxAttempts ? Number(tuning.retryMaxAttempts) : undefined,
    retryDelayMs: tuning.retryDelayMs ? Number(tuning.retryDelayMs) * 1000 : undefined,
  };
  const tuned = Object.values(options).filter((v) => v !== undefined).length;
  const tuningInvalid =
    (options.concurrency !== undefined && (options.concurrency < 1 || options.concurrency > 20)) ||
    (options.rateLimitPerMinute !== undefined && (options.rateLimitPerMinute < 1 || options.rateLimitPerMinute > 600)) ||
    (options.retryMaxAttempts !== undefined && options.retryMaxAttempts > 10) ||
    (options.retryDelayMs !== undefined && (options.retryDelayMs < 1000 || options.retryDelayMs > 60_000));

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
        options: tuned ? options : undefined,
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
    <Panel i={1} className="extract-card">
      <div className="extract-form">
        <FormHead countrySelect={countrySelect} />

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
                min={country.startPeriod}
              />
            </div>
          </div>
          {start && (
            <p className="field-help">
              {when === 'range' ? `${plural(months.length, 'month')}. ` : ''}
              {latest ? `${fmtMonth(latest)} is the latest the source should have out.` : ''}
              {country.startPeriod ? ` Data starts in ${fmtMonth(country.startPeriod)}.` : ''}
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

        {/* Rarely changed, so two small toggles; their fields open below */}
        <div className="more-options">
          <button type="button" className={`more-toggle ${hsOpen ? 'open' : ''}`} aria-expanded={hsOpen} onClick={() => setHsOpen((o) => !o)}>
            Specific HS codes{useCodes ? ` · ${codes.length}` : ''}
            <Icon.ChevronDown size={13} />
          </button>
          <button type="button" className={`more-toggle ${tuneOpen ? 'open' : ''}`} aria-expanded={tuneOpen} onClick={() => setTuneOpen((o) => !o)}>
            Advanced options{tuned ? ` · ${tuned} changed` : ''}
            <Icon.ChevronDown size={13} />
          </button>
        </div>

        {hsOpen && (
          <div className="more-body">
            <textarea
              rows={3}
              className="control textarea mono"
              placeholder="Only these codes instead of the data set: paste them separated by commas, spaces or new lines, e.g. 0901, 090111"
              value={hsText}
              onChange={(e) => setHsText(e.target.value)}
              spellCheck={false}
              autoFocus
            />
            <p className="field-help">{info.hsCodeHint}</p>
          </div>
        )}

        {tuneOpen && (
          <div className="more-body">
            <div className="tuning-grid">
              <Field label="Parallel requests" htmlFor="tune-threads">
                <NumberInput id="tune-threads" value={tuning.concurrency} onChange={(v) => setTuning({ ...tuning, concurrency: v })} placeholder={tuningDefaults.concurrency} unit="at once" min={1} max={20} />
              </Field>
              <Field label="Request rate" htmlFor="tune-rate">
                <NumberInput id="tune-rate" value={tuning.rateLimitPerMinute} onChange={(v) => setTuning({ ...tuning, rateLimitPerMinute: v })} placeholder={tuningDefaults.rateLimitPerMinute} unit="per min" min={1} max={600} />
              </Field>
              <Field label="Retries" htmlFor="tune-retries">
                <NumberInput id="tune-retries" value={tuning.retryMaxAttempts} onChange={(v) => setTuning({ ...tuning, retryMaxAttempts: v })} placeholder={tuningDefaults.retryMaxAttempts} unit="times" min={0} max={10} />
              </Field>
              <Field label="First retry after" htmlFor="tune-delay">
                <NumberInput id="tune-delay" value={tuning.retryDelayMs} onChange={(v) => setTuning({ ...tuning, retryDelayMs: v })} placeholder={tuningDefaults.retryDelayMs} unit="sec" min={1} max={60} />
              </Field>
            </div>
            <p className="field-help">
              For this run only; empty fields keep the defaults shown. Faster rates can get blocked by some sources.{' '}
              {tuned > 0 && (
                <button type="button" className="text-btn" onClick={() => setTuning(NO_TUNING)}>
                  Reset
                </button>
              )}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="note note-error" role="alert">
          <Icon.Alert /> <span>{error}</span>
        </div>
      )}
      {!error && tuningInvalid && (
        <div className="note note-error" role="alert">
          <Icon.Alert />
          <span>Advanced options are out of range: 1–20 parallel requests, 1–600 per minute, 0–10 retries, 1–60 seconds.</span>
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
      {!error && beforeStart.length > 0 && (
        <div className="note note-error" role="alert">
          <Icon.Alert />
          <span>
            {country.name} has data from {fmtMonth(country.startPeriod!)} onwards; {listMonths(beforeStart)} can&apos;t be extracted. Pick later months.
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
          {tuned > 0 && (
            <div>
              <dt>Threads</dt>
              <dd>{options.concurrency ?? tuningDefaults.concurrency} at once</dd>
            </div>
          )}
        </dl>
        <Button variant="primary" icon={<Icon.Play />} loading={busy} disabled={!start || !end || beforeStart.length > 0 || tuningInvalid || (hsOpen && hsText.trim() !== '' && !codes.length)} onClick={run}>
          Run extraction{months.length > 1 ? ` · ${plural(months.length, 'month')}` : ''}
        </Button>
      </div>
    </Panel>
  );
}

/** The form's title, with the country picker beside it */
function FormHead({ countrySelect }: { countrySelect: React.ReactNode }) {
  return (
    <div className="extract-head">
      <div>
        <h2 className="panel-title">New extraction</h2>
        <p className="panel-desc">Runs on the extraction service; follow it live under Extractions.</p>
      </div>
      <div className="extract-country">
        <label className="sr-only" htmlFor="country">
          Country
        </label>
        {countrySelect}
      </div>
    </div>
  );
}

/** The chosen country's last 12 months, beside the form */
function CountryMonths({ country }: { country: Country }) {
  return (
    <Panel
      i={2}
      title="Last 12 months"
      desc={country.recentPeriods.length ? `${country.name} · ${fmtRange(country.recentPeriods.slice(-12))}` : country.name}
      actions={
        <Link href={`/countries/${country.code}`} className="link link-quiet">
          All months <Icon.ChevronRight size={12} />
        </Link>
      }
    >
      <RecentMonths country={country} />
      <div className="months-foot">
        <MonthLegend />
        <span className="foot-summary">{country.latestCompleted ? `Latest completed ${fmtMonth(country.latestCompleted)}` : 'Nothing completed yet'}</span>
      </div>
    </Panel>
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
  if (!countries || service.status === 'checking' || !extractors) return <ExtractSkeleton />;

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
          <ExtractForm country={country} info={info} countrySelect={countrySelect} />
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
        <CountryMonths country={country} />
      </aside>
    </div>
  );
}

export function ExtractView() {
  return (
    <>
      <ExtractBody />
    </>
  );
}
