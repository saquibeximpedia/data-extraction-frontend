'use client';

import { useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { ExportFile } from '@/lib/types';
import { fmtDate, fmtMonth, fmtRelative, fmtSize } from '@/lib/format';
import { useChangedKeys } from '@/lib/hooks';
import { Badge, Button, CodeAvatar, ConfirmModal, Icon, Menu, Skeleton, useToast, type MenuItem } from './ui';

interface CountryGroup {
  countryCode: string;
  years: { year: string; files: ExportFile[] }[];
}

/** Country → year → files, newest month first */
function groupFiles(files: ExportFile[]): CountryGroup[] {
  const byCountry = new Map<string, Map<string, ExportFile[]>>();
  for (const f of files) {
    const cc = f.countryCode ?? 'Other';
    const year = f.period?.slice(0, 4) ?? 'Other';
    const years = byCountry.get(cc) ?? new Map<string, ExportFile[]>();
    years.set(year, [...(years.get(year) ?? []), f]);
    byCountry.set(cc, years);
  }
  return [...byCountry.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([countryCode, years]) => ({
      countryCode,
      years: [...years.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([year, list]) => ({
          year,
          files: list.sort((a, b) => (b.period ?? '').localeCompare(a.period ?? '') || a.fileName.localeCompare(b.fileName)),
        })),
    }));
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
  const allVisible = visible.map((f) => f.relativePath);
  const selectedFiles = files.filter((f) => selected.has(f.relativePath));
  const selectedBytes = selectedFiles.reduce((sum, f) => sum + f.sizeBytes, 0);

  function toggle(paths: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of paths) on ? next.add(p) : next.delete(p);
      return next;
    });
  }
  const stateOf = (paths: string[]) => {
    const n = paths.filter((p) => selected.has(p)).length;
    return { checked: paths.length > 0 && n === paths.length, indeterminate: n > 0 && n < paths.length };
  };

  async function download(path: string) {
    try {
      await api.download(path);
    } catch (err) {
      toast('err', 'Could not download', err instanceof ApiError ? err.message : 'The API server did not respond.');
    }
  }

  async function downloadSelected() {
    setZipping(true);
    try {
      if (selected.size === 1) await api.download([...selected][0]);
      else await api.downloadZip([...selected]);
      toast('ok', 'Download started', `${selected.size} file${selected.size === 1 ? '' : 's'}${selected.size > 1 ? ' in one zip' : ''}`);
    } catch (err) {
      toast('err', 'Could not download', err instanceof ApiError ? err.message : 'The API server did not respond.');
    } finally {
      setZipping(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { deleted } = await api.deleteFiles(toDelete);
      toast('ok', 'Deleted', `${deleted.length} file${deleted.length === 1 ? '' : 's'}`);
      toggle(toDelete, false);
      setToDelete(null);
      refreshFiles();
    } catch (err) {
      toast('err', 'Could not delete', err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const fileActions = (f: ExportFile): MenuItem[] => [
    { label: 'Download', icon: <Icon.Download size={14} />, onSelect: () => download(f.relativePath) },
    {
      label: 'Copy path',
      icon: <Icon.Copy size={14} />,
      onSelect: () => navigator.clipboard?.writeText(f.relativePath).then(() => toast('ok', 'Path copied', f.relativePath)),
    },
    { label: 'Delete file', icon: <Icon.Trash size={14} />, separator: true, onSelect: () => setToDelete([f.relativePath]) },
  ];

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
            <button type="button" className={`chip-btn ${country === 'ALL' ? 'active' : ''}`} onClick={() => setCountry('ALL')}>
              All countries
            </button>
            {countryCodes.map((cc) => (
              <button key={cc} type="button" className={`chip-btn ${country === cc ? 'active' : ''}`} onClick={() => setCountry(cc)}>
                {cc}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" icon={<Icon.Refresh size={14} />} loading={refreshing.files} onClick={refreshFiles}>
            Refresh
          </Button>
        </div>

        <div className={`bulk-bar ${selected.size ? 'on' : ''}`} aria-live="polite">
          <Check label="Select all shown files" {...stateOf(allVisible)} onChange={(on) => (on ? toggle(allVisible, true) : setSelected(new Set()))} />
          <span className="bulk-text">
            {selected.size
              ? `${selected.size} selected · ${fmtSize(selectedBytes)}`
              : loading
                ? 'Loading…'
                : `${visible.length} file${visible.length === 1 ? '' : 's'}`}
          </span>
          {selected.size > 0 && (
            <>
              <Button variant="primary" size="sm" icon={<Icon.Download size={14} />} loading={zipping} onClick={downloadSelected}>
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
          <div className="padded" style={{ display: 'grid', gap: 10 }}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
        )}
        {!loading && groups.length === 0 && (
          <p className="empty">{files.length ? 'No files match your search.' : 'No files yet. Run an extraction or upload files for a download-only country.'}</p>
        )}

        {groups.map((g) => {
          const groupPaths = g.years.flatMap((y) => y.files.map((f) => f.relativePath));
          const isCollapsed = collapsed.has(g.countryCode);
          return (
            <div key={g.countryCode} className="file-group">
              <div className="file-group-head">
                <Check label={`Select all ${g.countryCode} files`} {...stateOf(groupPaths)} onChange={(on) => toggle(groupPaths, on)} />
                <button
                  type="button"
                  className="file-group-toggle"
                  onClick={() =>
                    setCollapsed((c) => {
                      const next = new Set(c);
                      next.has(g.countryCode) ? next.delete(g.countryCode) : next.add(g.countryCode);
                      return next;
                    })
                  }
                  aria-expanded={!isCollapsed}
                >
                  <span className={`group-chevron ${isCollapsed ? 'closed' : ''}`}>
                    <Icon.ChevronDown />
                  </span>
                  <CodeAvatar code={g.countryCode} />
                  <span className="cell-strong">{countryName(g.countryCode)}</span>
                  <span className="cell-sub-color">
                    {groupPaths.length} file{groupPaths.length === 1 ? '' : 's'}
                  </span>
                </button>
              </div>

              {!isCollapsed &&
                g.years.map((y) => {
                  const yearPaths = y.files.map((f) => f.relativePath);
                  return (
                    <div key={y.year}>
                      <div className="file-year-head">
                        <Check label={`Select all ${g.countryCode} ${y.year} files`} {...stateOf(yearPaths)} onChange={(on) => toggle(yearPaths, on)} />
                        <span>{y.year}</span>
                      </div>
                      <div className="table-wrap">
                        <table className="table files-table">
                          <tbody>
                            {y.files.map((f) => (
                              <tr key={f.relativePath} className={changed.has(f.relativePath) ? 'flash' : ''}>
                                <td className="cell-check">
                                  <Check label={`Select ${f.fileName}`} checked={selected.has(f.relativePath)} onChange={(on) => toggle([f.relativePath], on)} />
                                </td>
                                <td>
                                  <div className="cell-strong">{f.period ? fmtMonth(f.period) : f.fileName}</div>
                                  <div className="cell-sub mono">{f.relativePath}</div>
                                </td>
                                <td style={{ width: 120 }}>
                                  {f.origin === 'uploaded' ? <Badge tone="blue">Uploaded</Badge> : <Badge tone="green">Extracted</Badge>}
                                </td>
                                <td className="cell-sub-color nowrap" style={{ width: 90 }}>
                                  {fmtSize(f.sizeBytes)}
                                </td>
                                <td className="cell-sub-color nowrap col-updated" style={{ width: 120 }} title={fmtDate(f.modifiedAt)}>
                                  {fmtRelative(f.modifiedAt)}
                                </td>
                                <td className="nowrap" style={{ width: 150, textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                    <Button size="sm" icon={<Icon.Download size={14} />} onClick={() => download(f.relativePath)}>
                                      Download
                                    </Button>
                                    <Menu items={fileActions(f)} label="File options" />
                                  </div>
                                </td>
                              </tr>
                            ))}
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
            Extracted rows stay in the ledger, so extracting the month again rebuilds its file.
          </>
        }
        confirmLabel={toDelete && toDelete.length > 1 ? `Delete ${toDelete.length} files` : 'Delete file'}
        confirmVariant="danger"
        loading={deleting}
      />
    </>
  );
}
