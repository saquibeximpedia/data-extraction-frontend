'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorText } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Country, ExportFile } from '@/lib/types';
import { fmtDate, fmtMonth, fmtRelative, fmtSize, plural } from '@/lib/format';
import { useAction, useChangedKeys } from '@/lib/hooks';
import { latestPublished, MONTH_LABELS, monthState, nowPeriod, yearPeriods } from '@/lib/months';
import { MarkCompletedButton, RemoveMonthsButton } from './CountryAction';
import { Badge, Button, CodeTag, ConfirmModal, Empty, FileIcon, FilterTabs, Icon, Menu, revealStyle, SearchInput, Skeleton, useToast, type MenuItem } from './ui';

const RECENT = 'RECENT';

/** Supabase's free plan stores 1 GB; set NEXT_PUBLIC_STORAGE_LIMIT_MB for another plan */
const STORAGE_LIMIT = (Number(process.env.NEXT_PUBLIC_STORAGE_LIMIT_MB) || 1024) * 1048576;

/** Uploaded files are stored as "{CC}_{YYYY-MM}__{original name}"; show the original name */
const displayName = (f: ExportFile) => (f.origin === 'uploaded' && f.fileName.includes('__') ? f.fileName.split('__').slice(1).join('__') : f.fileName);
const sizeOf = (files: ExportFile[]) => files.reduce((n, f) => n + f.sizeBytes, 0);
const pathsOf = (files: ExportFile[]) => files.map((f) => f.relativePath);
const monthKey = (f: ExportFile) => `${f.countryCode}|${f.period}`;

function Check({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      className="check"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate) && !checked;
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/** How much of the storage plan the files take */
function StorageMeter({ used, loading }: { used: number; loading: boolean }) {
  const pct = Math.min(100, (used / STORAGE_LIMIT) * 100);
  const tone = pct >= 95 ? 'red' : pct >= 80 ? 'amber' : '';
  return (
    <div className={`storage ${tone}`} title={`${fmtSize(used)} of ${fmtSize(STORAGE_LIMIT)} (${pct.toFixed(1)}%)`}>
      <div className="storage-head">
        <span className="storage-label">
          <Icon.Storage size={14} /> Storage used
        </span>
        <span className="storage-value">{loading ? '…' : `${fmtSize(used)} of ${fmtSize(STORAGE_LIMIT)}`}</span>
      </div>
      <div className="meter" role="meter" aria-label="Storage used" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${Math.max(pct, used ? 1 : 0)}%` }} />
      </div>
    </div>
  );
}

export function FilesView() {
  const { files: data, filesError, countries, refreshing, refreshFiles } = useApp();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const files = data ?? [];
  const loading = data === null;
  const changed = useChangedKeys(files.map((f) => ({ key: f.relativePath, signature: f.modifiedAt })));

  const [query, setQuery] = useState('');
  const [year, setYear] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const { busy: deleting, run } = useAction();

  const countryName = (code: string) => countries?.find((c) => c.code === code)?.name ?? code;

  // Countries with files, by name
  const groups = useMemo(() => {
    const map = new Map<string, ExportFile[]>();
    for (const f of files) map.set(f.countryCode ?? 'Other', [...(map.get(f.countryCode ?? 'Other') ?? []), f]);
    return [...map.entries()].map(([code, list]) => ({ code, files: list })).sort((a, b) => countryName(a.code).localeCompare(countryName(b.code)));
  }, [files, countries]);

  // How many parts each split month has
  const partCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of files) if (f.part) map.set(monthKey(f), (map.get(monthKey(f)) ?? 0) + 1);
    return map;
  }, [files]);

  const view = params.get('country')?.toUpperCase() ?? RECENT;
  const setView = (code: string) => {
    setYear(null);
    setQuery('');
    router.replace(code === RECENT ? '/files' : `/files?country=${code}`, { scroll: false });
  };
  const group = groups.find((g) => g.code === view);

  // Search matches the file name, its path, the country and the month as written ("Aug 2026")
  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q
        ? files.filter((f) => [f.fileName, f.relativePath, f.countryCode ? countryName(f.countryCode) : '', f.period ? fmtMonth(f.period) : ''].join(' ').toLowerCase().includes(q))
        : [],
    [files, q, countries]
  );

  function toggle(paths: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of paths) on ? next.add(p) : next.delete(p);
      return next;
    });
  }
  const checkFor = (paths: string[], label: string) => {
    const n = paths.filter((p) => selected.has(p)).length;
    return { label, checked: paths.length > 0 && n === paths.length, indeterminate: n > 0 && n < paths.length, onChange: (on: boolean) => toggle(paths, on) };
  };
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  async function download(paths: string[], key = paths.join('|')) {
    setBusy(key);
    try {
      if (paths.length === 1) await api.download(paths[0]);
      else await api.downloadZip(paths);
    } catch (err) {
      toast('err', 'Could not download', errorText(err));
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    if (!toDelete) return;
    const paths = toDelete;
    run(() => api.deleteFiles(paths), ({ deleted }) => `Deleted ${plural(deleted.length, 'file')}`, () => {
      toggle(paths, false);
      setToDelete(null);
      refreshFiles();
    }, 'Could not delete');
  }

  const fileActions = (f: ExportFile): MenuItem[] => [
    {
      label: 'Copy path',
      icon: <Icon.Copy size={15} />,
      onSelect: () => navigator.clipboard?.writeText(f.relativePath).then(() => toast('ok', 'Path copied', f.relativePath)),
    },
    ...(f.countryCode ? [{ label: `Open ${countryName(f.countryCode)}`, icon: <Icon.Calendar size={15} />, href: `/countries/${f.countryCode}` }] : []),
    { label: 'Delete file', icon: <Icon.Trash size={15} />, separator: true, danger: true, onSelect: () => setToDelete([f.relativePath]) },
  ];

  /** One file: icon, name, facts, actions; in select mode the whole row toggles it */
  const fileRow = (f: ExportFile, showWhere = false) => {
    const isSelected = selected.has(f.relativePath);
    return (
      <li
        key={f.relativePath}
        className={`file-row ${selecting ? 'selectable' : ''} ${isSelected ? 'selected' : ''} ${changed.has(f.relativePath) ? 'flash' : ''}`}
        onClick={selecting ? () => toggle([f.relativePath], !isSelected) : undefined}
      >
        {selecting && <Check {...checkFor([f.relativePath], `Select ${f.fileName}`)} />}
        <FileIcon name={f.fileName} />
        <span className="file-row-text" title={f.relativePath}>
          <span className="file-row-name">{displayName(f)}</span>
          <span className="file-row-meta">
            {showWhere && f.countryCode && (
              <>
                <b>{countryName(f.countryCode)}</b> · {f.period ? fmtMonth(f.period) : 'Other'} ·{' '}
              </>
            )}
            {f.part ? `Part ${f.part} of ${partCounts.get(monthKey(f)) ?? f.part} · ` : ''}
            {fmtSize(f.sizeBytes)} · <span title={fmtDate(f.modifiedAt)}>{fmtRelative(f.modifiedAt)}</span>
          </span>
        </span>
        {!selecting && (
          <span className="file-row-actions">
            <Button size="sm" variant="ghost" iconOnly aria-label={`Download ${f.fileName}`} title="Download" loading={busy === f.relativePath} icon={<Icon.Download size={16} />} onClick={() => download([f.relativePath])} />
            <Menu items={fileActions(f)} label="File options" />
          </span>
        )}
      </li>
    );
  };

  // ---------------------------------------------------------------- main area

  let head: { title: React.ReactNode; desc: React.ReactNode; visible: ExportFile[] };
  let body: React.ReactNode;

  if (loading) {
    head = { title: 'Files', desc: 'Loading…', visible: [] };
    body = (
      <div className="skeleton-rows">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={44} radius={8} />
        ))}
      </div>
    );
  } else if (q) {
    head = { title: 'Search results', desc: `${plural(results.length, 'file')} match “${query.trim()}”`, visible: results.slice(0, 200) };
    body = results.length ? <ul className="file-list">{results.slice(0, 200).map((f) => fileRow(f, true))}</ul> : <Empty>No files match.</Empty>;
  } else if (!group) {
    const recent = files.slice(0, 30);
    head = { title: 'Recent files', desc: `The latest ${recent.length} added or replaced, across every country`, visible: recent };
    body = recent.length ? <ul className="file-list">{recent.map((f) => fileRow(f, true))}</ul> : <Empty>No files yet. They appear here once an extraction saves them.</Empty>;
  } else {
    const years = [...new Set(group.files.map((f) => f.period?.slice(0, 4) ?? 'Other'))].sort().reverse();
    const shownYear = year && years.includes(year) ? year : years[0];
    const yearFiles = group.files.filter((f) => (f.period?.slice(0, 4) ?? 'Other') === shownYear);
    const monthsWithFiles = new Set(group.files.map((f) => f.period).filter(Boolean)).size;
    const groupCountry = countries?.find((c) => c.code === group.code);

    head = {
      title: (
        <span className="title-with-code">
          {countryName(group.code)} {group.code !== 'Other' && <CodeTag code={group.code} />}
        </span>
      ),
      desc: `${plural(group.files.length, 'file')} · ${fmtSize(sizeOf(group.files))} · ${plural(monthsWithFiles, 'month')}`,
      visible: yearFiles,
    };
    body = (
      <>
        <div className="files-subbar">
          <FilterTabs<string>
            label="Year"
            value={shownYear}
            onChange={setYear}
            options={years.map((y) => ({ value: y, label: y, count: group.files.filter((f) => (f.period?.slice(0, 4) ?? 'Other') === y).length }))}
          />
          <div className="inline-form">
            {group.code !== 'Other' && (
              <Link href={`/countries/${group.code}`} className="btn btn-ghost btn-sm">
                Months <Icon.ChevronRight size={13} />
              </Link>
            )}
            <Button size="sm" variant="secondary" icon={<Icon.Download size={14} />} loading={busy === `year-${shownYear}`} onClick={() => download(pathsOf(yearFiles), `year-${shownYear}`)}>
              {yearFiles.length === 1 ? 'Download' : `Download ${shownYear}`}
            </Button>
          </div>
        </div>
        {shownYear === 'Other' ? <ul className="file-list">{yearFiles.map((f) => fileRow(f))}</ul> : monthList(Number(shownYear), yearFiles, groupCountry)}
      </>
    );
  }

  /** A year's files as one list, grouped under each month that has files (newest first) */
  function monthList(year: number, yearFiles: ExportFile[], country?: Country) {
    // Up to the latest month the source should have out, so unpublished months don't show as missing
    const current = (country && latestPublished(country)) || nowPeriod();
    const periods = yearPeriods(year).filter((p) => p <= current || yearFiles.some((f) => f.period === p));
    const withFiles = [...periods].reverse().filter((p) => yearFiles.some((f) => f.period === p));
    const without = periods.filter((p) => !yearFiles.some((f) => f.period === p));

    return (
      <div className="month-list">
        {withFiles.map((p) => {
          const inMonth = yearFiles.filter((f) => f.period === p).sort((a, b) => (a.part ?? 0) - (b.part ?? 0) || a.fileName.localeCompare(b.fileName));
          const state = country ? monthState(country, p) : 'none';
          return (
            <section key={p} className="month-group">
              <header className="month-group-head">
                {selecting && <Check {...checkFor(pathsOf(inMonth), `Select ${fmtMonth(p)} files`)} />}
                <span className="month-group-name">{fmtMonth(p)}</span>
                {state === 'completed' && (
                  <Badge tone="green" dot>
                    Completed
                  </Badge>
                )}
                {state === 'extracting' && (
                  <Badge tone="amber" dot>
                    Not checked yet
                  </Badge>
                )}
                <span className="month-group-meta">
                  {inMonth.length > 1 ? `${plural(inMonth.length, 'file')} · ` : ''}
                  {fmtSize(sizeOf(inMonth))}
                </span>
                {country && state === 'extracting' && !selecting && (
                  <span className="month-group-actions">
                    <RemoveMonthsButton country={country} periods={[p]} />
                    <MarkCompletedButton country={country} periods={[p]} label="Mark completed" variant="secondary" />
                  </span>
                )}
              </header>
              <ul className="file-list">{inMonth.map((f) => fileRow(f))}</ul>
            </section>
          );
        })}
        {without.length > 0 && <p className="month-list-missing">No files for {without.map((p) => MONTH_LABELS[Number(p.slice(5, 7)) - 1]).join(', ')}</p>}
      </div>
    );
  }

  const selectedFiles = files.filter((f) => selected.has(f.relativePath));
  const visiblePaths = pathsOf(head.visible);

  return (
    <>
      {filesError && (
        <div className="note note-error note-tight" role="alert">
          <Icon.Alert />
          <span>
            <b>Files could not be listed.</b> {filesError}
          </span>
        </div>
      )}
      <div className="files-layout reveal" style={revealStyle(1)}>
        <aside className="files-side" aria-label="Countries">
          <SearchInput value={query} onChange={setQuery} placeholder="Search files" />
          <StorageMeter used={sizeOf(files)} loading={loading} />

          <nav className="side-list">
            <button type="button" className={`side-item ${!group && !q ? 'active' : ''}`} onClick={() => setView(RECENT)}>
              <Icon.Clock size={15} />
              <span className="side-name">Recent</span>
              <span className="side-meta">{loading ? '' : files.length.toLocaleString()}</span>
            </button>
            <span className="side-label">Countries</span>
            {loading && <Skeleton height={32} radius={6} />}
            {groups.map((g) => (
              <button key={g.code} type="button" className={`side-item ${group?.code === g.code && !q ? 'active' : ''}`} onClick={() => setView(g.code)} title={`${plural(g.files.length, 'file')} · ${fmtSize(sizeOf(g.files))}`}>
                <Icon.Folder size={15} />
                <span className="side-name">{countryName(g.code)}</span>
                <span className="side-meta">{fmtSize(sizeOf(g.files))}</span>
              </button>
            ))}
            {!loading && groups.length === 0 && <span className="side-meta padded-side">No files yet</span>}
          </nav>

          <Button size="sm" variant="ghost" icon={<Icon.Refresh size={14} />} loading={refreshing.files} onClick={refreshFiles} className="side-refresh">
            Refresh
          </Button>
        </aside>

        <section className="files-main">
          <div className="files-main-head">
            <div>
              <h2 className="panel-title">{head.title}</h2>
              <p className="panel-desc">{head.desc}</p>
            </div>
            {head.visible.length > 0 &&
              (selecting ? (
                <div className="inline-form">
                  <label className="toggle">
                    <Check {...checkFor(visiblePaths, 'Select all shown')} /> Select all
                  </label>
                  <Button size="sm" variant="ghost" onClick={stopSelecting}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" icon={<Icon.Select size={15} />} onClick={() => setSelecting(true)}>
                  Select
                </Button>
              ))}
          </div>
          {body}
        </section>
      </div>

      <div className={`selection-dock ${selected.size ? 'on' : ''}`} aria-live="polite" aria-hidden={!selected.size}>
        <div className="selection-dock-inner surface-pop">
          <span className="bulk-text">
            <b>{plural(selected.size, 'file')}</b> · {fmtSize(sizeOf(selectedFiles))}
          </span>
          <Button variant="primary" size="sm" icon={<Icon.Download size={14} />} loading={busy === 'selection'} onClick={() => download([...selected], 'selection')}>
            {selected.size === 1 ? 'Download' : 'Download zip'}
          </Button>
          <Button variant="secondary" size="sm" className="btn-danger-ghost" icon={<Icon.Trash size={14} />} onClick={() => setToDelete([...selected])}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" iconOnly aria-label="Clear selection" icon={<Icon.X size={14} />} onClick={() => setSelected(new Set())} />
        </div>
      </div>

      <ConfirmModal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title={toDelete && toDelete.length > 1 ? `Delete ${toDelete.length} files?` : 'Delete file?'}
        description={
          <>
            {toDelete?.length === 1 ? (
              <>
                <b className="mono">{toDelete[0]}</b> is removed from storage.
              </>
            ) : (
              <>These files are removed from storage.</>
            )}{' '}
            Extracting the month again recreates an extracted file. Month status is not changed.
          </>
        }
        confirmLabel={toDelete && toDelete.length > 1 ? `Delete ${toDelete.length} files` : 'Delete file'}
        confirmVariant="danger"
        loading={deleting}
      />
    </>
  );
}
