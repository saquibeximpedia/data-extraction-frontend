'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Field, Icon, MonthRangePicker, NumberInput, Panel, Segmented, type MonthPreset } from '@/components/ui';
import { fmtFlows, fmtMonth, fmtRange, plural, fmtNumber } from '@/lib/format';
import { addMonths, dueMonths, isPeriod, latestPublished, periodRange } from '@/lib/months';
import { errorText } from '@/lib/result';
import type { AppSettings, Country, ExtractorInfo, RunOptions, TradeFlow } from '@/lib/types';
import { extractor } from '@/modules/service/client';
import { useApp } from '@/modules/service/store';

type Flow = 'ALL' | TradeFlow;
type Mode = 'complete' | 'test';
type When = 'month' | 'range';

/** The months asked for in the link (from the dashboard or "Run again") */
export interface RequestedMonths {
  start?: string;
  end?: string;
}

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

/** Months to start with: the ones in the link, else every due month, else the latest */
function initialMonths(country: Country, requested: RequestedMonths): [string, string] {
  const start = requested.start ?? '';
  const end = requested.end ?? start;
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

/** The form's title, with the country picker beside it */
export function FormHead({ countrySelect }: { countrySelect: React.ReactNode }) {
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

/** Months, flows, data set and per-run options for one country; Run starts it and opens its page */
export function ExtractForm({ country, info, requested, countrySelect }: { country: Country; info: ExtractorInfo; requested: RequestedMonths; countrySelect: React.ReactNode }) {
  const { service, refreshLiveRuns } = useApp();
  const router = useRouter();
  const isProd = Boolean(service.health?.isProd);

  const [[start, end], setMonths] = useState(() => initialMonths(country, requested));
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
      // Its page finds it among the live runs before the database has it
      await refreshLiveRuns();
      router.push(`/extractions/${runId}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const listMonths = (periods: string[]) => (periods.length > 3 ? plural(periods.length, 'month') : periods.map(fmtMonth).join(', '));
  const tuningField = (key: keyof RunOptions, label: string, unit: string, min: number, max: number) => (
    <Field label={label} htmlFor={`tune-${key}`}>
      <NumberInput id={`tune-${key}`} value={tuning[key]} onChange={(v) => setTuning({ ...tuning, [key]: v })} placeholder={tuningDefaults[key]} unit={unit} min={min} max={max} />
    </Field>
  );
  const note = (tone: 'warn' | 'error', children: React.ReactNode) => (
    <div className={`note note-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon.Alert /> <span>{children}</span>
    </div>
  );

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
                { value: 'complete', label: `Complete · ${fmtNumber(info.hsCodeCount)}` },
                { value: 'test', label: `Test · ${fmtNumber(info.testHsCodeCount)}`, disabled: isProd || !info.testHsCodeCount },
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
              {tuningField('concurrency', 'Parallel requests', 'at once', 1, 20)}
              {tuningField('rateLimitPerMinute', 'Request rate', 'per min', 1, 600)}
              {tuningField('retryMaxAttempts', 'Retries', 'times', 0, 10)}
              {tuningField('retryDelayMs', 'First retry after', 'sec', 1, 60)}
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

      {error && note('error', error)}
      {!error && tuningInvalid && note('error', 'Advanced options are out of range: 1–20 parallel requests, 1–600 per minute, 0–10 retries, 1–60 seconds.')}
      {!error &&
        completed.length > 0 &&
        note(
          'warn',
          <>
            {listMonths(completed)} {completed.length === 1 ? 'is' : 'are'} already completed. Extracting again replaces {completed.length === 1 ? 'its file' : 'their files'} and marks{' '}
            {completed.length === 1 ? 'it' : 'them'} extracting until checked again.
          </>
        )}
      {!error &&
        extracting.length > 0 &&
        note(
          'warn',
          <>
            {listMonths(extracting)} {extracting.length === 1 ? 'was' : 'were'} extracted already and {extracting.length === 1 ? 'is' : 'are'} waiting to be checked.{' '}
            <Link href={`/countries/${country.code}`} className="link">
              Review instead
            </Link>
          </>
        )}
      {!error &&
        beforeStart.length > 0 &&
        note('error', `${country.name} has data from ${fmtMonth(country.startPeriod!)} onwards; ${listMonths(beforeStart)} can't be extracted. Pick later months.`)}
      {!error && unpublished.length > 0 && note('warn', `${listMonths(unpublished)} may not be published yet, so the source can return no rows.`)}

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
            <dd>{useCodes ? plural(codes.length, 'custom code') : `${fmtNumber(savedCount)} ${effectiveMode}`}</dd>
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
