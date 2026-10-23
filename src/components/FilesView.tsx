'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorText } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { ExportFile } from '@/lib/types';
import { fmtDate, fmtMonth, fmtRelative, fmtSize, plural } from '@/lib/format';
import { useChangedKeys } from '@/lib/hooks';
import { MONTH_LABELS, nowPeriod, yearPeriods } from '@/lib/months';
import { Button, CodeAvatar, ConfirmModal, Icon, Menu, Skeleton, useToast, type MenuItem } from './ui';

const RECENT = 'RECENT';
type Origin = 'all' | 'extracted' | 'uploaded';

/** Uploaded files are stored as "{CC}_{YYYY-MM}__{original name}"; show the original name */
const displayName = (f: ExportFile) => (f.origin === 'uploaded' && f.fileName.includes('__') ? f.fileName.split('__').slice(1).join('__') : f.fileName);
const extOf = (f: ExportFile) => f.fileName.split('.').pop()?.toLowerCase() ?? '';
const sizeOf = (files: ExportFile[]) => files.reduce((n, f) => n + f.sizeBytes, 0);
const pathsOf = (files: ExportFile[]) => files.map((f) => f.relativePath);

function FileIcon({ file }: { file: ExportFile }) {
  const ext = extOf(file);
  return (
    <span className={`file-icon ext-${ext === 'zip' ? 'zip' : ext === 'csv' ? 'csv' : 'xls'}`} aria-hidden="true">
      {ext === 'zip' ? <Icon.Archive size={15} /> : <Icon.Sheet size={15} />}
    </span>
  );
}

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

export function FilesView() {
  const { files: data, countries, refreshing, refreshFiles } = useApp();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const files = data ?? [];
  const loading = data === null;
  const changed = useChangedKeys(files.map((f) => ({ key: f.relativePath, signature: f.modifiedAt })));

  const [query, setQuery] = useState('');
  const [origin, setOrigin] = useState<Origin>('all');
  const [year, setYear] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const countryName = (code: string) => countries?.find((c) => c.code === code)?.name ?? code;
  const filtered = useMemo(() => files.filter((f) => origin === 'all' || f.origin === origin), [files, origin]);

  // Countries with files, by name
  const groups = useMemo(() => {
    const map = new Map<string, ExportFile[]>();
    for (const f of filtered) map.set(f.countryCode ?? 'Other', [...(map.get(f.countryCode ?? 'Other') ?? []), f]);
    return [...map.entries()].map(([code, list]) => ({ code, files: list })).sort((a, b) => countryName(a.code).localeCompare(countryName(b.code)));
  }, [filtered, countries]);

  const view = (params.get('country')?.toUpperCase() ?? RECENT) as string;
  const setView = (code: string) => {
    setYear(null);
    router.replace(code === RECENT ? '/files' : `/files?country=${code}`, { scroll: false });
  };
  const group = groups.find((g) => g.code === view);

  // Search matches the file name, its path, the country and the month as written ("Aug 2026")
  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q
        ? filtered.filter((f) =>
            [f.fileName, f.relativePath, f.countryCode ? countryName(f.countryCode) : '', f.period ? fmtMonth(f.period) : ''].join(' ').toLowerCase().includes(q)
          )
        : [],
    [filtered, q, countries]
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

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { deleted } = await api.deleteFiles(toDelete);
      toast('ok', 'Deleted', plural(deleted.length, 'file'));
      toggle(toDelete, false);
      setToDelete(null);
      refreshFiles();
    } catch (err) {
      toast('err', 'Could not delete', errorText(err));
    } finally {
      setDeleting(false);
    }
  }

  const fileActions = (f: ExportFile): MenuItem[] => [
    {
      label: 'Copy path',
      icon: <Icon.Copy size={14} />,
      onSelect: () => navigator.clipboard?.writeText(f.relativePath).then(() => toast('ok', 'Path copied', f.relativePath)),
    },
    ...(f.countryCode ? [{ label: `Open ${countryName(f.countryCode)}`, icon: <Icon.Calendar size={14} />, href: `/countries/${f.countryCode}` }] : []),
    { label: 'Delete file', icon: <Icon.Trash size={14} />, separator: true, onSelect: () => setToDelete([f.relativePath]) },
  ];

  /** One file as a compact row: icon, name, facts, actions */
  const fileRow = (f: ExportFile, showWhere = false) => (
    <li key={f.relativePath} className={`file-row ${selected.has(f.relativePath) ? 'selected' : ''} ${changed.has(f.relativePath) ? 'flash' : ''}`}>
      <Check {...checkFor([f.relativePath], `Select ${f.fileName}`)} />
      <FileIcon file={f} />
      <span className="file-row-text" title={f.relativePath}>
        <span className="file-row-name">{displayName(f)}</span>
        <span className="file-row-meta">
          {showWhere && f.countryCode && (
            <>
              <b>{countryName(f.countryCode)}</b> · {f.period ? fmtMonth(f.period) : 'Other'} ·{' '}
            </>
          )}
          {fmtSize(f.sizeBytes)} · <span title={fmtDate(f.modifiedAt)}>{fmtRelative(f.modifiedAt)}</span>
          {f.origin === 'uploaded' && (
            <>
              {' '}
              · <span className="origin-uploaded">uploaded</span>
            </>
          )}
        </span>
      </span>
      <span className="file-row-actions">
        <Button size="sm" variant="ghost" iconOnly aria-label={`Download ${f.fileName}`} title="Download" loading={busy === f.relativePath} icon={<Icon.Download size={15} />} onClick={() => download([f.relativePath])} />
        <Menu items={fileActions(f)} label="File options" />
      </span>
    </li>
  );

  // ---------------------------------------------------------------- main area

  let main: React.ReactNode;
  if (loading) {
    main = (
      <div className="files-main-pad skeleton-rows">
        <Skeleton height={28} width={220} />
        <div className="month-board">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} height={110} radius={18} />
          ))}
        </div>
      </div>
    );
  } else if (q) {
    main = (
      <div className="files-main-pad">
        <div className="files-main-head">
          <div>
            <h2 className="panel-title">Search results</h2>
            <p className="panel-desc">
              {plural(results.length, 'file')} match “{query.trim()}”
            </p>
          </div>
          {results.length > 0 && <Check {...checkFor(pathsOf(results), 'Select all results')} />}
        </div>
        {results.length ? <ul className="file-list">{results.slice(0, 200).map((f) => fileRow(f, true))}</ul> : <p className="empty">No files match.</p>}
      </div>
    );
  } else if (!group) {
    const recent = filtered.slice(0, 30);
    main = (
      <div className="files-main-pad">
        <div className="files-main-head">
          <div>
            <h2 className="panel-title">Recent files</h2>
            <p className="panel-desc">The latest {recent.length} added or replaced, across every country</p>
          </div>
        </div>
        {recent.length ? (
          <ul className="file-list">{recent.map((f) => fileRow(f, true))}</ul>
        ) : (
          <p className="empty">{files.length ? 'No files of this kind.' : 'No files yet. Run an extraction, or upload files for a download-only country.'}</p>
        )}
      </div>
    );
  } else {
    const years = [...new Set(group.files.map((f) => f.period?.slice(0, 4) ?? 'Other'))].sort().reverse();
    const shownYear = year && years.includes(year) ? year : years[0];
    const yearFiles = group.files.filter((f) => (f.period?.slice(0, 4) ?? 'Other') === shownYear);
    const periods = shownYear === 'Other' ? [] : yearPeriods(Number(shownYear));
    const current = nowPeriod();
    const monthsWithFiles = new Set(group.files.map((f) => f.period).filter(Boolean)).size;
    const latest = group.files.map((f) => f.period).filter(Boolean).sort().pop();

    main = (
      <div className="files-main-pad">
        <div className="files-main-head">
          <div className="files-country-title">
            <CodeAvatar code={group.code} />
            <div>
              <h2 className="panel-title">{countryName(group.code)}</h2>
              <p className="panel-desc">
                {plural(group.files.length, 'file')} · {fmtSize(sizeOf(group.files))} · {plural(monthsWithFiles, 'month')}
                {latest ? ` · latest ${fmtMonth(latest)}` : ''}
              </p>
            </div>
          </div>
          {group.code !== 'Other' && (
            <Link href={`/countries/${group.code}`} className="btn btn-ghost btn-sm">
              Months <Icon.ChevronRight size={13} />
            </Link>
          )}
        </div>

        <div className="year-tabs-row">
          <div className="year-tabs" role="tablist" aria-label="Year">
            {years.map((y) => {
              const n = group.files.filter((f) => (f.period?.slice(0, 4) ?? 'Other') === y).length;
              return (
                <button key={y} type="button" role="tab" aria-selected={y === shownYear} className={`year-tab ${y === shownYear ? 'active' : ''}`} onClick={() => setYear(y)}>
                  {y}
                  <span className="year-tab-count">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="inline-form">
            <Check {...checkFor(pathsOf(yearFiles), `Select all ${shownYear} files`)} />
            <Button size="sm" variant="secondary" icon={<Icon.Download size={13} />} loading={busy === `year-${shownYear}`} onClick={() => download(pathsOf(yearFiles), `year-${shownYear}`)}>
              {yearFiles.length === 1 ? 'Download' : `Download ${shownYear} (${yearFiles.length})`}
            </Button>
          </div>
        </div>

        {shownYear === 'Other' ? (
          <ul className="file-list">{yearFiles.map((f) => fileRow(f))}</ul>
        ) : (
          <div className="month-board">
            {periods.map((p, i) => {
              const inMonth = yearFiles.filter((f) => f.period === p).sort((a, b) => a.origin.localeCompare(b.origin) || a.fileName.localeCompare(b.fileName));
              const future = p > current;
              return (
                <div key={p} className={`month-card ${inMonth.length ? 'has-files' : 'empty-month'} ${future ? 'future' : ''}`}>
                  <div className="month-card-head">
                    <span className="month-card-name">{MONTH_LABELS[i]}</span>
                    {inMonth.length > 0 ? (
                      <>
                        <span className="month-card-size">{fmtSize(sizeOf(inMonth))}</span>
                        {inMonth.length > 1 && <Check {...checkFor(pathsOf(inMonth), `Select ${fmtMonth(p)} files`)} />}
                      </>
                    ) : null}
                  </div>
                  {inMonth.length ? <ul className="file-list compact">{inMonth.map((f) => fileRow(f))}</ul> : <span className="month-card-empty">{future ? 'Not out yet' : 'No file'}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const selectedFiles = files.filter((f) => selected.has(f.relativePath));

  return (
    <>
      <div className="files-layout reveal" style={{ '--i': 1 } as React.CSSProperties}>
        <aside className="files-side glass" aria-label="Countries">
          <label className="search">
            <Icon.Search size={15} />
            <input type="search" className="search-input" placeholder="Search files" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search files" />
            {query && (
              <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                <Icon.X size={13} />
              </button>
            )}
          </label>

          <div className="origin-filter" role="radiogroup" aria-label="Kind of file">
            {(['all', 'extracted', 'uploaded'] as Origin[]).map((o) => (
              <button key={o} type="button" role="radio" aria-checked={origin === o} className={origin === o ? 'active' : ''} onClick={() => setOrigin(o)}>
                {o === 'all' ? 'All' : o === 'extracted' ? 'Extracted' : 'Uploaded'}
              </button>
            ))}
          </div>

          <nav className="side-list">
            <button type="button" className={`side-item ${!group && !q ? 'active' : ''}`} onClick={() => (setQuery(''), setView(RECENT))}>
              <span className="side-icon">
                <Icon.Clock size={15} />
              </span>
              <span className="side-text">
                <span className="side-name">Recent</span>
                <span className="side-meta">{loading ? 'Loading…' : `${plural(filtered.length, 'file')} · ${fmtSize(sizeOf(filtered))}`}</span>
              </span>
            </button>
            <span className="side-label">Countries</span>
            {loading && <Skeleton height={44} radius={14} />}
            {groups.map((g) => (
              <button key={g.code} type="button" className={`side-item ${group?.code === g.code && !q ? 'active' : ''}`} onClick={() => (setQuery(''), setView(g.code))}>
                <CodeAvatar code={g.code} />
                <span className="side-text">
                  <span className="side-name">{countryName(g.code)}</span>
                  <span className="side-meta">
                    {plural(g.files.length, 'file')} · {fmtSize(sizeOf(g.files))}
                  </span>
                </span>
              </button>
            ))}
            {!loading && groups.length === 0 && <span className="side-meta padded-side">No files yet</span>}
          </nav>

          <Button size="sm" variant="ghost" icon={<Icon.Refresh size={13} />} loading={refreshing.files} onClick={refreshFiles} className="side-refresh">
            Refresh
          </Button>
        </aside>

        <section className="files-main glass">{main}</section>
      </div>

      <div className={`selection-dock ${selected.size ? 'on' : ''}`} aria-live="polite" aria-hidden={!selected.size}>
        <div className="selection-dock-inner surface-pop">
          <span className="bulk-text">
            <b>{plural(selected.size, 'file')}</b> selected · {fmtSize(sizeOf(selectedFiles))}
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
