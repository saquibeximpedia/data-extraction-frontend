'use client';

import { useMemo, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { ExportFile } from '@/lib/types';
import { fmtDate, fmtMonth, fmtRelative, fmtSize, plural } from '@/lib/format';
import { useChangedKeys } from '@/lib/hooks';
import { Badge, Button, CodeAvatar, ConfirmModal, Icon, Menu, Skeleton, useToast, type MenuItem } from './ui';

interface MonthGroup {
  period: string;
  files: ExportFile[];
}
interface YearGroup {
  year: string;
  months: MonthGroup[];
}
interface CountryGroup {
  countryCode: string;
  years: YearGroup[];
}

/** Groups items by key, keeping the keys sorted (descending when `desc`) */
function groupBy<T>(items: T[], key: (item: T) => string, desc = false): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return [...map.entries()].sort(([a], [b]) => (desc ? b.localeCompare(a) : a.localeCompare(b)));
}

/** Country → year → month (newest first) → files */
function groupFiles(files: ExportFile[]): CountryGroup[] {
  return groupBy(files, (f) => f.countryCode ?? 'Other').map(([countryCode, list]) => ({
    countryCode,
    years: groupBy(list, (f) => f.period?.slice(0, 4) ?? 'Other', true).map(([year, inYear]) => ({
      year,
      months: groupBy(inYear, (f) => f.period ?? 'Other', true).map(([period, inMonth]) => ({
        period,
        files: inMonth.sort((a, b) => a.origin.localeCompare(b.origin) || a.fileName.localeCompare(b.fileName)),
      })),
    })),
  }));
}

/** Uploaded files are stored as "{CC}_{YYYY-MM}__{original name}"; show the original name */
const displayName = (f: ExportFile) => (f.origin === 'uploaded' && f.fileName.includes('__') ? f.fileName.split('__').slice(1).join('__') : f.fileName);

const pathsOf = (files: ExportFile[]) => files.map((f) => f.relativePath);

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
  const files = data ?? [];
  const loading = data === null;
  const changed = useChangedKeys(files.map((f) => ({ key: f.relativePath, signature: f.modifiedAt })));

  const [query, setQuery] = useState('');
  const [country, setCountry] = useState<string>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zipping, setZipping] = useState(false);
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const countryName = (code: string) => countries?.find((c) => c.code === code)?.name ?? code;
  const countryCodes = useMemo(() => [...new Set(files.map((f) => f.countryCode).filter(Boolean) as string[])].sort(), [files]);

  // Search matches the file name, its path, the country and the month as written ("Aug 2026")
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter((f) => {
      if (country !== 'ALL' && f.countryCode !== country) return false;
      if (!q) return true;
      return [f.fileName, f.relativePath, f.countryCode ? countryName(f.countryCode) : '', f.period ? fmtMonth(f.period) : '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [files, query, country, countries]);

  const groups = useMemo(() => groupFiles(visible), [visible]);
  const allVisible = pathsOf(visible);
  const selectedBytes = files.filter((f) => selected.has(f.relativePath)).reduce((sum, f) => sum + f.sizeBytes, 0);

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

  async function download(paths: string[]) {
    setZipping(paths.length > 1);
    try {
      if (paths.length === 1) await api.download(paths[0]);
      else await api.downloadZip(paths);
    } catch (err) {
      toast('err', 'Could not download', errorText(err));
    } finally {
      setZipping(false);
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
    { label: 'Delete file', icon: <Icon.Trash size={14} />, separator: true, onSelect: () => setToDelete([f.relativePath]) },
  ];

  const toggleCollapsed = (code: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  return (
    <>
      <section className="panel glass panel-flush reveal" style={{ '--i': 1 } as React.CSSProperties}>
        <div className="files-toolbar padded">
          <label className="search">
            <Icon.Search size={15} />
            <input
              type="search"
              className="search-input"
              placeholder="Search by file name, country or month"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search files"
            />
          </label>
          <div className="chip-group" role="group" aria-label="Filter by country">
            {['ALL', ...countryCodes].map((cc) => (
              <button key={cc} type="button" className={`chip-btn ${country === cc ? 'active' : ''}`} onClick={() => setCountry(cc)}>
                {cc === 'ALL' ? 'All countries' : cc}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" icon={<Icon.Refresh size={14} />} loading={refreshing.files} onClick={refreshFiles}>
            Refresh
          </Button>
        </div>

        <div className={`bulk-bar ${selected.size ? 'on' : ''}`} aria-live="polite">
          <Check {...checkFor(allVisible, 'Select all shown files')} />
          <span className="bulk-text">
            {selected.size ? `${selected.size} selected · ${fmtSize(selectedBytes)}` : loading ? 'Loading…' : plural(visible.length, 'file')}
          </span>
          {selected.size > 0 && (
            <>
              <Button variant="primary" size="sm" icon={<Icon.Download size={14} />} loading={zipping} onClick={() => download([...selected])}>
                {selected.size === 1 ? 'Download' : `Download ${selected.size} (zip)`}
              </Button>
              <Button variant="secondary" size="sm" className="btn-danger-ghost" icon={<Icon.Trash size={14} />} onClick={() => setToDelete([...selected])}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </>
          )}
        </div>

        {loading && (
          <div className="padded skeleton-rows">
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
        )}
        {!loading && groups.length === 0 && (
          <p className="empty">{files.length ? 'No files match your search.' : 'No files yet. Run an extraction or upload files for a download-only country.'}</p>
        )}

        {groups.map((g) => {
          const countryFiles = g.years.flatMap((y) => y.months.flatMap((m) => m.files));
          const isCollapsed = collapsed.has(g.countryCode);
          return (
            <div key={g.countryCode} className="file-group">
              <div className="file-group-head">
                <Check {...checkFor(pathsOf(countryFiles), `Select all ${g.countryCode} files`)} />
                <button type="button" className="file-group-toggle" onClick={() => toggleCollapsed(g.countryCode)} aria-expanded={!isCollapsed}>
                  <span className={`group-chevron ${isCollapsed ? 'closed' : ''}`}>
                    <Icon.ChevronDown />
                  </span>
                  <CodeAvatar code={g.countryCode} />
                  <span className="cell-strong">{countryName(g.countryCode)}</span>
                  <span className="cell-sub-color">
                    {plural(countryFiles.length, 'file')} · {plural(g.years.reduce((n, y) => n + y.months.length, 0), 'month')}
                  </span>
                </button>
              </div>

              {!isCollapsed &&
                g.years.map((y) => {
                  const yearFiles = y.months.flatMap((m) => m.files);
                  return (
                    <div key={y.year}>
                      <div className="file-year-head">
                        <Check {...checkFor(pathsOf(yearFiles), `Select all ${g.countryCode} ${y.year} files`)} />
                        <span>{y.year}</span>
                        <span className="file-year-count">{plural(yearFiles.length, 'file')}</span>
                      </div>
                      <div className="table-wrap">
                        <table className="table files-table">
                          <tbody>
                            {y.months.flatMap((m) =>
                              m.files.map((f, i) => (
                                <tr key={f.relativePath} className={`${changed.has(f.relativePath) ? 'flash' : ''} ${i === 0 ? 'month-start' : ''}`}>
                                  <td className="cell-check">
                                    <Check {...checkFor([f.relativePath], `Select ${f.fileName}`)} />
                                  </td>
                                  <td className="cell-month">{i === 0 && (m.period === 'Other' ? 'Other' : fmtMonth(m.period))}</td>
                                  <td>
                                    <div className="file-name" title={f.relativePath}>
                                      <Icon.File size={14} />
                                      <span>{displayName(f)}</span>
                                    </div>
                                  </td>
                                  <td style={{ width: 110 }}>{f.origin === 'uploaded' ? <Badge tone="blue">Uploaded</Badge> : <Badge tone="green">Extracted</Badge>}</td>
                                  <td className="cell-sub-color nowrap" style={{ width: 90 }}>
                                    {fmtSize(f.sizeBytes)}
                                  </td>
                                  <td className="cell-sub-color nowrap col-updated" style={{ width: 120 }} title={fmtDate(f.modifiedAt)}>
                                    {fmtRelative(f.modifiedAt)}
                                  </td>
                                  <td className="nowrap" style={{ width: 150, textAlign: 'right' }}>
                                    <div className="row-actions">
                                      <Button size="sm" icon={<Icon.Download size={14} />} onClick={() => download([f.relativePath])}>
                                        Download
                                      </Button>
                                      <Menu items={fileActions(f)} label="File options" />
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </section>

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
            Extracting the month again recreates an extracted file.
          </>
        }
        confirmLabel={toDelete && toDelete.length > 1 ? `Delete ${toDelete.length} files` : 'Delete file'}
        confirmVariant="danger"
        loading={deleting}
      />
    </>
  );
}
