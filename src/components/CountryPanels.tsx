'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, errorText } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Country, Run } from '@/lib/types';
import { fmtDate, fmtFlows, fmtMonth, fmtRange, fmtRelative, fmtSize, hostOf, plural } from '@/lib/format';
import { useCountryStatus, useExtractability, useSetMonths } from '@/lib/hooks';
import { latestPublished, monthState } from '@/lib/months';
import type { CountryStatus } from '@/lib/status';
import { describeStep, MarkCompletedButton, NextAction, RemoveMonthsButton } from './CountryAction';
import { MiniRuns, RunProgress } from './RunParts';
import { Badge, Button, Empty, Icon, MonthRangePicker, Panel, revealStyle, StatTiles, StatusDot, useToast } from './ui';

/** Where the country's data comes from and how it is fetched: plain text on the page, no card */
export function SourceInfo({ country, i = 3 }: { country: Country; i?: number }) {
  const extractability = useExtractability();
  const { source } = country;
  const status = country.kind === 'manual' ? null : extractability(country.code);
  const latest = latestPublished(country);
  const facts: [string, React.ReactNode, boolean?][] = [
    ['Publication lag', `${plural(country.lagMonths, 'month')}${country.publishDay > 1 ? `, around day ${country.publishDay}` : ''}`],
    ['Latest expected', latest ? fmtMonth(latest) : '—'],
    ...(country.kind === 'api'
      ? ([
          ['Trade flows', fmtFlows(country.tradeTypes)],
          [
            'Saved HS codes',
            <>
              {country.hsCodeCount.toLocaleString()}
              {country.testHsCodeCount ? <span className="faint"> · {country.testHsCodeCount.toLocaleString()} test</span> : null}
            </>,
          ],
        ] as [string, React.ReactNode][])
      : []),
    ['HS codes accepted', country.hsCodeHint],
    ['Requests', source.endpoint && <span className="mono">{source.endpoint}</span>, true],
    ['How it is fetched', source.method, true],
    ['What is saved', source.output, true],
    ['Notes', country.notes && <span className="pre-wrap">{country.notes}</span>, true],
  ];

  return (
    <section className="source-info reveal" style={revealStyle(i)} aria-label="Source">
      <div className="section-head">
        <h2 className="section-title">Source</h2>
        {country.kind === 'manual' ? (
          <Badge>Download-only</Badge>
        ) : status?.ok ? (
          <Badge tone="green" dot>Ready to extract</Badge>
        ) : status?.reason === 'offline' ? (
          <Badge tone="red" dot>Service offline</Badge>
        ) : (
          <span title={status?.reason}>
            <Badge tone="amber" dot>Unavailable</Badge>
          </span>
        )}
      </div>

      {source.url && (
        <a className="source-link" href={source.url} target="_blank" rel="noreferrer">
          <Icon.Globe size={15} />
          <span className="source-name">{source.name || hostOf(source.url)}</span>
          <span className="source-url mono">{source.url}</span>
          <Icon.External size={13} />
        </a>
      )}

      <dl className="facts">
        {facts
          .filter(([, value]) => value)
          .map(([label, value, wide]) => (
            <div key={label} className={wide ? 'wide' : ''}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
    </section>
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
            Extracted months stay <b>extracting</b> until someone checks the files. Mark them completed once the files look right, or remove them to
            set them back to not done.{' '}
            <button type="button" className="text-btn" onClick={onEditMonths}>
              Change only some
            </button>
          </span>
        )}
      </div>
      <div className="next-step-actions">
        {next.kind === 'review' && (
          <>
            <RemoveMonthsButton country={country} periods={next.periods} size="md" />
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
            1. Open {hostOf(country.source.url)} <Icon.External size={13} />
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
