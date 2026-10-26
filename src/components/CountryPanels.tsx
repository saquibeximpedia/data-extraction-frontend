'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, errorText } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Country, Run } from '@/lib/types';
import { fmtDate, fmtFlows, fmtMonth, fmtRange, fmtRelative, fmtSize, hostOf, plural } from '@/lib/format';
import { useCountryStatus, useExtractability, useSetMonths } from '@/lib/hooks';
import { latestPublished, monthState, yearsFor } from '@/lib/months';
import type { CountryStatus } from '@/lib/status';
import { describeStep, MarkCompletedButton, NextAction } from './CountryAction';
import { MonthGrid, MonthLegend } from './MonthGrid';
import { MiniRuns, RunProgress } from './RunParts';
import { Badge, Button, CodeAvatar, Empty, Icon, MonthRangePicker, Panel, revealStyle, StatTiles, StatusDot, useToast } from './ui';

/** Where the country's data comes from and how it is fetched */
export function SourceCard({ country, i = 3 }: { country: Country; i?: number }) {
  const extractability = useExtractability();
  const { source } = country;
  const status = country.kind === 'manual' ? null : extractability(country.code);
  const facts: [string, React.ReactNode][] = [
    ['Requests', source.endpoint && <span className="mono source-endpoint">{source.endpoint}</span>],
    ['How it is fetched', source.method],
    ['What is saved', source.output],
    ['HS codes accepted', country.hsCodeHint],
    ['Notes', country.notes && <span className="pre-wrap">{country.notes}</span>],
  ];

  return (
    <Panel
      i={i}
      className="source-panel"
      icon={<CodeAvatar code={country.code} />}
      title="Source"
      desc={country.kind === 'manual' ? 'Files are downloaded by hand and uploaded' : 'Extracted by the extraction service'}
      actions={
        country.kind === 'manual' ? (
          <Badge tone="blue">Download-only</Badge>
        ) : status?.ok ? (
          <Badge tone="green">Ready</Badge>
        ) : status?.reason === 'offline' ? (
          <Badge>Service offline</Badge>
        ) : (
          <span title={status?.reason}>
            <Badge tone="amber">Unavailable</Badge>
          </span>
        )
      }
    >
      {source.url && (
        <a className="source-link" href={source.url} target="_blank" rel="noreferrer">
          <span>
            <span className="cell-strong">{source.name || hostOf(source.url)}</span>
            <span className="cell-sub mono source-url">{source.url}</span>
          </span>
          <Icon.ArrowRight size={14} />
        </a>
      )}

      <dl className="source-facts">
        <div className="fact-pair">
          <div>
            <dt>Publication lag</dt>
            <dd>
              {plural(country.lagMonths, 'month')}
              {country.publishDay > 1 ? `, around day ${country.publishDay}` : ''}
            </dd>
          </div>
          <div>
            <dt>Latest expected</dt>
            <dd>{latestPublished(country) ? fmtMonth(latestPublished(country)) : '—'}</dd>
          </div>
        </div>
        {country.kind === 'api' && (
          <div className="fact-pair">
            <div>
              <dt>Trade flows</dt>
              <dd>{fmtFlows(country.tradeTypes)}</dd>
            </div>
            <div>
              <dt>Saved HS codes</dt>
              <dd>
                {country.hsCodeCount.toLocaleString()}
                {country.testHsCodeCount ? <span className="faint"> · {country.testHsCodeCount.toLocaleString()} test</span> : null}
              </dd>
            </div>
          </div>
        )}
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
    </Panel>
  );
}

/** Headline numbers for a country */
export function CountryStats({ country, status }: { country: Country; status: CountryStatus }) {
  const { latest, behind } = status;
  const completed = country.completedMonths;
  return (
    <StatTiles
      i={1}
      tiles={[
        {
          label: 'Latest completed',
          value: country.latestCompleted ? fmtMonth(country.latestCompleted) : 'None yet',
          sub: behind === null ? (latest ? `${fmtMonth(latest)} is out` : '') : behind === 0 ? 'Up to date' : `${plural(behind, 'month')} behind`,
          tone: behind === 0 ? 'green' : behind ? 'amber' : '',
        },
        { label: 'Months completed', value: completed.length.toLocaleString(), sub: completed.length ? (completed.length === 1 ? fmtMonth(completed[0]) : `since ${fmtMonth(completed[0])}`) : '' },
        {
          label: 'To check',
          value: status.review.length.toLocaleString(),
          sub: status.review.length ? fmtRange(status.review) : status.running ? 'Extracting now' : 'Nothing waiting',
          tone: status.review.length ? 'amber' : '',
        },
        { label: 'Last extracted', value: country.lastExtractedAt ? fmtRelative(country.lastExtractedAt) : 'Never', sub: fmtDate(country.lastExtractedAt) },
      ]}
    />
  );
}

/**
 * The country's next step, spelled out at the top of its page: check and mark extracted months,
 * follow the running extraction, or extract / upload what is due.
 */
export function NextStepCard({ country, onEditMonths }: { country: Country; onEditMonths: () => void }) {
  const status = useCountryStatus(country);
  const { next } = status;
  const step = describeStep(country, status);
  if (next.kind === 'done') return null;

  return (
    <section className={`next-step next-${next.kind} reveal`} style={revealStyle(2)} aria-label="Next step">
      <div className="next-step-text">
        <span className="next-step-eyebrow">
          <StatusDot tone={step.tone} live={next.kind === 'running'} /> Next step
        </span>
        <span className="next-step-title">{step.text}</span>
        {next.kind === 'running' && <RunProgress run={next.run} />}
        {next.kind === 'review' && (
          <span className="next-step-help">
            Extracted months stay <b>extracting</b> until someone checks the files. Marking them completed moves the dashboard on.{' '}
            <button type="button" className="text-btn" onClick={onEditMonths}>
              Mark only some
            </button>
          </span>
        )}
      </div>
      <div className="next-step-actions">
        {next.kind === 'review' && (
          <>
            <Link href={`/files?country=${country.code}`} className="btn btn-secondary btn-md">
              <Icon.Folder size={14} /> Check files
            </Link>
            <MarkCompletedButton country={country} periods={next.periods} size="md" />
          </>
        )}
        {next.kind !== 'review' && <NextAction country={country} status={status} size="md" />}
      </div>
    </section>
  );
}

/** This year and last at a glance, with a link to the full list */
export function MonthsGlance({ country, i = 4 }: { country: Country; i?: number }) {
  return (
    <Panel
      i={i}
      title="Months done"
      desc={
        country.latestCompleted ? (
          <>
            Latest completed <b className="text-strong">{fmtMonth(country.latestCompleted)}</b> · {plural(country.completedMonths.length, 'month')} in total
          </>
        ) : (
          'No months completed yet'
        )
      }
    >
      <MonthGrid country={country} years={yearsFor(country).slice(0, 2)} compact />
      <div className="months-card-foot">
        <MonthLegend />
        <Link href={`/countries/${country.code}`} className="btn btn-secondary btn-sm">
          All months <Icon.ChevronRight size={14} />
        </Link>
      </div>
    </Panel>
  );
}

/** A country's latest extractions */
export function RecentRuns({ country, i = 4 }: { country: Country; i?: number }) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const { runs: all } = useApp();
  // Refetch when the global list changes (a run started or ended)
  const signature = all?.map((r) => `${r.id}:${r.status}`).join('|');
  useEffect(() => {
    api.runs(5, country.code).then(setRuns).catch(() => setRuns([]));
  }, [country.code, signature]);

  return (
    <Panel
      i={i}
      title="Recent extractions"
      desc={runs === null ? 'Loading…' : runs.length ? `Last ${runs.length}` : 'None yet'}
      actions={
        <Link href="/extractions" className="link">
          All <Icon.ChevronRight size={14} />
        </Link>
      }
    >
      {runs && runs.length > 0 && <MiniRuns runs={runs} country={country.code} />}
    </Panel>
  );
}

const ACCEPTED = /\.(xlsx|xls|csv|zip)$/i;

/** Download-only countries: open the source, then upload its files under a month (and mark it completed) */
export function UploadPanel({ country, i = 2 }: { country: Country; i?: number }) {
  const { files, refreshFiles } = useApp();
  const toast = useToast();
  const { due } = useCountryStatus(country);
  const { setMonths } = useSetMonths();
  const suggested = due[0] ?? latestPublished(country);
  const [period, setPeriod] = useState(suggested);
  const [picked, setPicked] = useState<File[]>([]);
  const [markDone, setMarkDone] = useState(true);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setPeriod(suggested), [country.code]);

  const countryFiles = (files ?? []).filter((f) => f.countryCode === country.code).slice(0, 6);
  const alreadyDone = monthState(country, period) === 'completed';

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
    setPicked([]);
    if (input.current) input.current.value = '';
    refreshFiles();
    if (done && markDone && !alreadyDone) await setMonths(country, [period], 'completed');
    else if (done) toast('ok', 'Uploaded', `${plural(done, 'file')} for ${country.name} ${fmtMonth(period)}`);
    setBusy(false);
  }

  const accept = (list: FileList | null) => {
    const all = [...(list ?? [])];
    const ok = all.filter((f) => ACCEPTED.test(f.name));
    if (ok.length < all.length) toast('err', `${plural(all.length - ok.length, 'file')} skipped`, 'Upload .xlsx, .xls, .csv or .zip files');
    setPicked(ok);
  };

  return (
    <Panel
      id="upload"
      i={i}
      title="Upload files"
      desc="This source publishes files, so nothing is extracted. Download them from the source and keep them here."
      actions={
        country.source.url && (
          <a className="btn btn-secondary btn-sm" href={country.source.url} target="_blank" rel="noreferrer">
            1. Open {hostOf(country.source.url)} <Icon.ArrowRight size={13} />
          </a>
        )
      }
    >
      <div className="upload-grid">
        <div className="field">
          <span className="field-label">2. Month the files are for</span>
          <MonthRangePicker single start={period} end={period} onChange={(s) => setPeriod(s)} marked={country.completedMonths} markedLabel="Completed" />
        </div>
        <label
          className={`dropzone ${over ? 'over' : ''} ${picked.length ? 'has-files' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            accept(e.dataTransfer.files);
          }}
        >
          <input ref={input} type="file" multiple accept=".xlsx,.xls,.csv,.zip" className="sr-only" onChange={(e) => accept(e.target.files)} />
          <Icon.Upload size={18} />
          {picked.length ? (
            <span className="dropzone-text">
              <b>{plural(picked.length, 'file')}</b> · {picked.map((f) => `${f.name} (${fmtSize(f.size)})`).join(', ')}
            </span>
          ) : (
            <span className="dropzone-text">
              <b>3. Drop files here</b> or click to choose · .xlsx, .xls, .csv, .zip
            </span>
          )}
        </label>
      </div>

      <div className="panel-foot">
        {alreadyDone ? (
          <span className="foot-summary">{fmtMonth(period)} is already completed. A file with the same name is replaced.</span>
        ) : (
          <label className="toggle">
            <input type="checkbox" className="check" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} />
            Mark {period ? fmtMonth(period) : 'the month'} completed after uploading
          </label>
        )}
        <Button variant="primary" icon={<Icon.Upload size={14} />} loading={busy} disabled={!period || !picked.length} onClick={upload}>
          Upload {picked.length > 1 ? plural(picked.length, 'file') : 'file'}
        </Button>
      </div>

      {countryFiles.length > 0 ? (
        <div className="recent-files">
          <span className="field-label">Latest files for {country.name}</span>
          <ul>
            {countryFiles.map((f) => (
              <li key={f.relativePath}>
                <button type="button" className="text-btn" onClick={() => api.download(f.relativePath)}>
                  <Icon.Download size={12} /> {f.fileName.split('__').slice(1).join('__') || f.fileName}
                </button>
                <span className="cell-sub">
                  {f.period ? fmtMonth(f.period) : ''} · {fmtRelative(f.modifiedAt)}
                </span>
              </li>
            ))}
          </ul>
          <Link href={`/files?country=${country.code}`} className="link">
            All files <Icon.ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        files && <Empty>No files uploaded for {country.name} yet.</Empty>
      )}
    </Panel>
  );
}
