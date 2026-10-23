'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, errorText } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Country, Run } from '@/lib/types';
import { describePlan, fmtDate, fmtMonth, fmtRelative, fmtSize, plural } from '@/lib/format';
import { latestPublished, yearsFor } from '@/lib/months';
import { useExtractability } from '@/lib/hooks';
import { MonthGrid, MonthLegend } from './MonthGrid';
import { Badge, Button, CodeAvatar, Icon, MonthRangePicker, useToast } from './ui';

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'source';
  }
};

/** Where the country's data comes from and how it is fetched */
export function SourceCard({ country, i = 3 }: { country: Country; i?: number }) {
  const { serviceLive } = useApp();
  const extractability = useExtractability();
  const { source } = country;
  const status = country.kind === 'manual' ? null : extractability(country.code);

  return (
    <section className="panel glass reveal source-panel" style={{ '--i': i } as React.CSSProperties}>
      <div className="panel-head">
        <div className="source-title">
          <CodeAvatar code={country.code} />
          <div>
            <h2 className="panel-title">Source</h2>
            <p className="panel-desc">{country.kind === 'manual' ? 'Files are downloaded by hand and uploaded' : 'Extracted by the extraction service'}</p>
          </div>
        </div>
        {country.kind === 'manual' ? (
          <Badge tone="blue">Download-only</Badge>
        ) : !serviceLive ? (
          <Badge>Service offline</Badge>
        ) : status?.ok ? (
          <Badge tone="green">Ready</Badge>
        ) : (
          <span title={status?.reason}>
            <Badge tone="amber">Unavailable</Badge>
          </span>
        )}
      </div>

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
              <dd>{country.tradeTypes.length ? country.tradeTypes.map((t) => t.charAt(0) + t.slice(1).toLowerCase()).join(' & ') : '—'}</dd>
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
        {source.endpoint && (
          <div>
            <dt>Requests</dt>
            <dd className="mono source-endpoint">{source.endpoint}</dd>
          </div>
        )}
        {source.method && (
          <div>
            <dt>How it is fetched</dt>
            <dd>{source.method}</dd>
          </div>
        )}
        {source.output && (
          <div>
            <dt>What is saved</dt>
            <dd>{source.output}</dd>
          </div>
        )}
        {country.hsCodeHint && (
          <div>
            <dt>HS codes accepted</dt>
            <dd>{country.hsCodeHint}</dd>
          </div>
        )}
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

/** Headline numbers for a country */
export function CountryStats({ country }: { country: Country }) {
  const latest = latestPublished(country);
  const behind = latest && country.latestCompleted ? Math.max(0, monthsBetween(country.latestCompleted, latest)) : null;
  const tiles = [
    {
      label: 'Latest completed',
      value: country.latestCompleted ? fmtMonth(country.latestCompleted) : 'None yet',
      sub: behind === null ? (latest ? `${fmtMonth(latest)} is out` : '') : behind === 0 ? 'Up to date' : `${plural(behind, 'month')} behind`,
      tone: behind === 0 ? 'green' : behind ? 'amber' : '',
    },
    { label: 'Months completed', value: country.completedMonths.length.toLocaleString(), sub: country.completedMonths.length ? fmtRangeShort(country.completedMonths) : '' },
    { label: 'Extracting', value: country.extractingMonths.length.toLocaleString(), sub: country.extractingMonths.length ? 'Check, then mark completed' : 'Nothing pending', tone: country.extractingMonths.length ? 'amber' : '' },
    { label: 'Last extracted', value: country.lastExtractedAt ? fmtRelative(country.lastExtractedAt) : 'Never', sub: country.lastExtractedAt ? fmtDate(country.lastExtractedAt) : '' },
  ];
  return (
    <section className="stat-row reveal" style={{ '--i': 1 } as React.CSSProperties}>
      {tiles.map((t) => (
        <div key={t.label} className={`stat-tile glass ${t.tone ? `stat-${t.tone}` : ''}`}>
          <span className="stat-label">{t.label}</span>
          <span className="stat-value">{t.value}</span>
          <span className="stat-sub">{t.sub || ' '}</span>
        </div>
      ))}
    </section>
  );
}

const monthsBetween = (from: string, to: string) => {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
};
const fmtRangeShort = (periods: string[]) => (periods.length === 1 ? fmtMonth(periods[0]) : `since ${fmtMonth(periods[0])}`);

/** This year and last at a glance, with a link to the full list */
export function MonthsGlance({ country, i = 4 }: { country: Country; i?: number }) {
  return (
    <section className="panel glass reveal" style={{ '--i': i } as React.CSSProperties}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Months done</h2>
          <p className="panel-desc">
            {country.latestCompleted ? (
              <>
                Latest completed <b className="text-strong">{fmtMonth(country.latestCompleted)}</b> · {plural(country.completedMonths.length, 'month')} in total
              </>
            ) : (
              'No months completed yet'
            )}
          </p>
        </div>
      </div>
      <MonthGrid country={country} years={yearsFor(country).slice(0, 2)} compact />
      <div className="months-card-foot">
        <MonthLegend />
        <Link href={`/countries/${country.code}`} className="btn btn-secondary btn-sm">
          View complete list <Icon.ChevronRight size={14} />
        </Link>
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
    <section className="panel glass reveal" style={{ '--i': i } as React.CSSProperties}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Recent extractions</h2>
          <p className="panel-desc">{runs === null ? 'Loading…' : runs.length ? `Last ${runs.length}` : 'None yet'}</p>
        </div>
        <Link href="/extractions" className="link">
          All <Icon.ChevronRight size={14} />
        </Link>
      </div>
      {runs && runs.length > 0 && (
        <ul className="mini-runs">
          {runs.map((r) => {
            const plan = r.params?.plans?.find((p) => p.countryCode === country.code);
            return (
              <li key={r.id}>
                <Link href={`/extractions/${r.id}`} className="mini-run">
                  <span className={`dot ${r.status === 'COMPLETED' ? 'dot-green' : r.status === 'RUNNING' ? 'dot-blue dot-live' : r.status === 'FAILED' ? 'dot-red' : 'dot-amber'}`} />
                  <span className="mini-run-text">
                    <span className="cell-strong">{plan ? describePlan({ ...plan, countryCode: '' }) : 'Extraction'}</span>
                    <span className="cell-sub">
                      {fmtRelative(r.startedAt)}
                      {r.stats.records !== undefined ? ` · ${r.stats.records.toLocaleString()} rows` : ''}
                    </span>
                  </span>
                  <Icon.ChevronRight size={14} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Download-only countries: open the source, then upload its files under a month */
export function UploadPanel({ country, i = 2 }: { country: Country; i?: number }) {
  const { files, refreshFiles } = useApp();
  const toast = useToast();
  const latest = latestPublished(country);
  const [period, setPeriod] = useState(latest);
  const [picked, setPicked] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setPeriod(latest), [country.code]);

  const countryFiles = (files ?? []).filter((f) => f.countryCode === country.code).slice(0, 6);

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

  const accept = (list: FileList | null) => setPicked([...(list ?? [])].filter((f) => /\.(xlsx|xls|csv|zip)$/i.test(f.name)));

  return (
    <section id="upload" className="panel glass reveal" style={{ '--i': i } as React.CSSProperties}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Upload files</h2>
          <p className="panel-desc">This source publishes files, so nothing is extracted. Download them from the source and keep them here.</p>
        </div>
        {country.source.url && (
          <a className="btn btn-secondary btn-sm" href={country.source.url} target="_blank" rel="noreferrer">
            Open {hostOf(country.source.url)} <Icon.ArrowRight size={13} />
          </a>
        )}
      </div>

      <div className="upload-grid">
        <div className="field">
          <span className="field-label">Month the files are for</span>
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
              <b>Drop files here</b> or click to choose · .xlsx, .xls, .csv, .zip
            </span>
          )}
        </label>
      </div>

      <div className="panel-foot">
        <span className="foot-summary">{period ? `Saved under ${country.name} · ${fmtMonth(period)}. A file with the same name is replaced.` : ' '}</span>
        <Button variant="primary" icon={<Icon.Upload size={14} />} loading={busy} disabled={!period || !picked.length} onClick={upload}>
          Upload {picked.length > 1 ? plural(picked.length, 'file') : 'file'}
        </Button>
      </div>

      {countryFiles.length > 0 && (
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
      )}
    </section>
  );
}
