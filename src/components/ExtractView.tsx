'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorText } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Country, TradeFlow } from '@/lib/types';
import { fmtMonth, fmtRange, fmtRelative, fmtSize, plural } from '@/lib/format';
import { addMonths, latestPublished, yearsFor } from '@/lib/months';
import { EditMonthsLink, MonthGrid, MonthLegend } from './MonthGrid';
import { Badge, Button, CodeAvatar, Field, Icon, MonthRangePicker, Segmented, Select, Skeleton, useToast, type MonthPreset } from './ui';

type Flow = 'ALL' | TradeFlow;
type Mode = 'complete' | 'test';

const splitCodes = (text: string) => [...new Set(text.split(/[\s,;]+/).filter(Boolean))];
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'source';
  }
};

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

function SourceCard({ country }: { country: Country }) {
  const { source } = country;
  return (
    <section className="panel glass reveal source-panel" style={{ '--i': 3 } as React.CSSProperties}>
      <div className="panel-head">
        <div className="source-title">
          <CodeAvatar code={country.code} />
          <div>
            <h2 className="panel-title">{country.name}</h2>
            <p className="panel-desc">Data source</p>
          </div>
        </div>
        {country.kind === 'manual' ? (
          <Badge tone="blue">Download-only</Badge>
        ) : country.enabled ? (
          <Badge tone="green">Ready</Badge>
        ) : (
          <Badge tone="amber">Needs {country.missingConfig.join(', ')}</Badge>
        )}
      </div>

      {source.url && (
        <a className="source-link" href={source.url} target="_blank" rel="noreferrer">
          <span>
            <span className="cell-strong">{source.name || source.url}</span>
            <span className="cell-sub mono source-url">{source.url}</span>
          </span>
          <Icon.ArrowRight size={14} />
        </a>
      )}

      <dl className="source-facts">
        {source.endpoint && (
          <div>
            <dt>Requests</dt>
            <dd className="mono source-endpoint">{source.endpoint}</dd>
          </div>
        )}
        <div>
          <dt>How it is fetched</dt>
          <dd>{source.method}</dd>
        </div>
        <div>
          <dt>What is saved</dt>
          <dd>{source.output}</dd>
        </div>
        <div>
          <dt>Publication lag</dt>
          <dd>{plural(country.lagMonths, 'month')}</dd>
        </div>
        {country.notes && (
          <div>
            <dt>Notes</dt>
            <dd className="pre-wrap">{country.notes}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/** This year and last at a glance, with a way to change them */
function MonthsCard({ country }: { country: Country }) {
  return (
    <section className="panel glass reveal" style={{ '--i': 4 } as React.CSSProperties}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Months</h2>
          <p className="panel-desc">{country.latestCompleted ? `Latest completed ${fmtMonth(country.latestCompleted)}` : 'No months completed yet'}</p>
        </div>
        <EditMonthsLink code={country.code} button />
      </div>
      <MonthGrid country={country} years={yearsFor(country).slice(0, 2)} compact />
      <div className="months-card-foot">
        <MonthLegend />
        <Link href={`/countries/${country.code}`} className="link">
          All years <Icon.ChevronRight size={14} />
        </Link>
      </div>
    </section>
  );
}

/** Extraction form for countries the backend extracts */
function ExtractForm({ country, countrySelect }: { country: Country; countrySelect: React.ReactNode }) {
  const { health, refreshActivity } = useApp();
  const toast = useToast();
  const router = useRouter();
  const isProd = Boolean(health?.isProd);
  const latest = latestPublished(country);

  const [range, setRange] = useState(false);
  const [start, setStart] = useState(latest);
  const [end, setEnd] = useState(latest);
  const [flow, setFlow] = useState<Flow>('ALL');
  const [mode, setMode] = useState<Mode>('complete');
  const [hsText, setHsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A new country starts again from its latest published month
  useEffect(() => {
    setStart(latest);
    setEnd(latest);
    setFlow('ALL');
    setError('');
  }, [country.code]);

  // Turning the range off keeps just the first month
  useEffect(() => {
    if (!range) setEnd(start);
  }, [range]);

  const codes = splitCodes(hsText);
  const effectiveMode: Mode = isProd ? 'complete' : mode;
  const overlap = start && end ? country.completedMonths.filter((p) => p >= start && p <= end) : [];
  const savedCount = effectiveMode === 'test' ? country.testHsCodeCount : country.hsCodeCount;

  async function run() {
    setBusy(true);
    setError('');
    try {
      const { runId } = await api.extract({
        countryCode: country.code,
        startDate: start,
        endDate: end,
        hsCodes: codes.length ? hsText.trim() : undefined,
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
    <section className="panel glass reveal" style={{ '--i': 2 } as React.CSSProperties}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Extraction details</h2>
          <p className="panel-desc">The chosen months are marked extracting. Mark them completed on Edit months once the files are checked.</p>
        </div>
      </div>

      <div className="extract-grid">
        <Field label="Country" htmlFor="country">
          {countrySelect}
        </Field>

        <Field
          label={range ? 'Months' : 'Month'}
          htmlFor="months"
          aside={
            <label className="toggle">
              <input type="checkbox" className="check" checked={range} onChange={(e) => setRange(e.target.checked)} />
              Date range
            </label>
          }
        >
          <MonthRangePicker
            id="months"
            single={!range}
            start={start}
            end={end}
            onChange={(s, e) => {
              setStart(s);
              setEnd(e);
            }}
            marked={country.completedMonths}
            markedLabel="Marked completed"
            presets={presetsFor(country, range)}
          />
        </Field>

        <Field label="Trade flow">
          <Segmented<Flow>
            label="Trade flow"
            value={flow}
            onChange={setFlow}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'IMPORT', label: 'Import', disabled: !country.tradeTypes.includes('IMPORT') },
              { value: 'EXPORT', label: 'Export', disabled: !country.tradeTypes.includes('EXPORT') },
            ]}
          />
        </Field>

        <Field label="Dataset">
          <Segmented<Mode>
            label="Dataset"
            value={effectiveMode}
            onChange={setMode}
            options={[
              { value: 'complete', label: `Complete (${country.hsCodeCount.toLocaleString()})` },
              { value: 'test', label: `Test (${country.testHsCodeCount.toLocaleString()})`, disabled: isProd || !country.testHsCodeCount },
            ]}
          />
        </Field>

        <details className="advanced">
          <summary>Advanced: specific HS codes</summary>
          <textarea
            rows={2}
            className="control textarea mono"
            placeholder="Leave empty to use the dataset above. Paste codes separated by commas or new lines."
            value={hsText}
            onChange={(e) => setHsText(e.target.value)}
            spellCheck={false}
          />
          <p className="field-help">
            {codes.length ? `${plural(codes.length, 'code')} replace the dataset. ` : ''}
            {country.hsCodeHint}
          </p>
        </details>
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
            {overlap.map(fmtMonth).join(', ')} {overlap.length === 1 ? 'is' : 'are'} already completed. Extracting again replaces{' '}
            {overlap.length === 1 ? 'its file' : 'their files'} and marks {overlap.length === 1 ? 'it' : 'them'} extracting.
          </span>
        </div>
      )}

      <div className="panel-foot">
        <span className="foot-summary">
          {start ? `${country.name} · ${fmtRange([start, end])} · ${codes.length ? plural(codes.length, 'HS code') : `${savedCount.toLocaleString()} ${effectiveMode} codes`}` : ' '}
        </span>
        <Button variant="primary" icon={<Icon.Play />} loading={busy} disabled={!start || !end || !country.enabled} onClick={run}>
          Run extraction
        </Button>
      </div>
    </section>
  );
}

/** For download-only countries: open the source, then upload the files here */
function UploadForm({ country, countrySelect }: { country: Country; countrySelect: React.ReactNode }) {
  const { files, refreshFiles } = useApp();
  const toast = useToast();
  const latest = latestPublished(country);
  const [period, setPeriod] = useState(latest);
  const [picked, setPicked] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setPeriod(latest), [country.code]);

  const countryFiles = (files ?? []).filter((f) => f.countryCode === country.code).slice(0, 8);

  async function upload() {
    setBusy(true);
    let done = 0;
    for (const file of picked) {
      try {
        await api.upload(country.code, period, file);
        done++;
      } catch (err) {
        toast('err', `Could not upload ${file.name}`, errorText(err));
      }
    }
    if (done) toast('ok', 'Uploaded', `${plural(done, 'file')} for ${country.name} ${fmtMonth(period)}`);
    setPicked([]);
    if (input.current) input.current.value = '';
    refreshFiles();
    setBusy(false);
  }

  return (
    <section className="panel glass reveal" style={{ '--i': 2 } as React.CSSProperties}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Get the files</h2>
          <p className="panel-desc">This source publishes files directly, so nothing is extracted. Download them and keep them here.</p>
        </div>
      </div>

      <div className="extract-grid">
        <Field label="Country" htmlFor="country">
          {countrySelect}
        </Field>
        <Field label="Source website">
          {country.source.url ? (
            <a className="btn btn-secondary btn-md" href={country.source.url} target="_blank" rel="noreferrer">
              Open {hostOf(country.source.url)} <Icon.ArrowRight size={14} />
            </a>
          ) : (
            <span className="field-help">No link yet; an admin can add it.</span>
          )}
        </Field>
        <Field label="Month the files are for" htmlFor="upload-month">
          <MonthRangePicker id="upload-month" single start={period} end={period} onChange={(s) => setPeriod(s)} marked={country.completedMonths} markedLabel="Marked completed" />
        </Field>
        <Field label="Files (.xlsx, .xls, .csv, .zip)" htmlFor="upload-files">
          <input
            id="upload-files"
            ref={input}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv,.zip"
            className="control file-input"
            onChange={(e) => setPicked([...(e.target.files ?? [])])}
          />
        </Field>
      </div>

      {picked.length > 0 && (
        <p className="field-help" style={{ marginTop: 10 }}>
          {picked.map((f) => `${f.name} (${fmtSize(f.size)})`).join(', ')}
        </p>
      )}

      <div className="panel-foot">
        <span className="foot-summary">{period ? `${country.name} · ${fmtMonth(period)}` : ' '}</span>
        <Button variant="primary" icon={<Icon.Plus />} loading={busy} disabled={!period || !picked.length} onClick={upload}>
          Upload {picked.length > 1 ? plural(picked.length, 'file') : 'file'}
        </Button>
      </div>

      {countryFiles.length > 0 && (
        <div className="recent-files">
          <span className="field-label">Recent files for {country.name}</span>
          <ul>
            {countryFiles.map((f) => (
              <li key={f.relativePath}>
                <button type="button" className="text-btn" onClick={() => api.download(f.relativePath)}>
                  <Icon.Download size={12} /> {f.fileName}
                </button>
                <span className="cell-sub">{fmtRelative(f.modifiedAt)}</span>
              </li>
            ))}
          </ul>
          <Link href="/files" className="link">
            All files <Icon.ChevronRight size={14} />
          </Link>
        </div>
      )}
    </section>
  );
}

export function ExtractView() {
  const { countries } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get('country')?.toUpperCase();
  const country = useMemo(() => countries?.find((c) => c.code === requested) ?? countries?.[0], [countries, requested]);

  if (!countries || !country) {
    return (
      <section className="panel glass">
        <Skeleton height={24} width={160} />
        <div style={{ display: 'grid', gap: 14, marginTop: 20 }}>
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
      </section>
    );
  }

  // The country lives in the URL, so the dashboard can link straight to one
  const countrySelect = (
    <Select
      id="country"
      value={country.code}
      onChange={(code) => router.replace(`/extract?country=${code}`)}
      options={countries.map((c) => ({
        value: c.code,
        label: c.name,
        meta: c.code,
        hint:
          c.kind === 'manual'
            ? 'Download-only source'
            : c.enabled
              ? `${c.lagMonths}m lag · ${c.hsCodeCount.toLocaleString()} saved codes`
              : `Needs ${c.missingConfig.join(', ')} on the server`,
        prefix: <CodeAvatar code={c.code} muted={!c.enabled} />,
      }))}
    />
  );

  return (
    <div className="overview-grid">
      {country.kind === 'manual' ? (
        <UploadForm country={country} countrySelect={countrySelect} />
      ) : (
        <ExtractForm country={country} countrySelect={countrySelect} />
      )}
      <div className="side-stack">
        <MonthsCard country={country} />
        <SourceCard country={country} />
      </div>
    </div>
  );
}
