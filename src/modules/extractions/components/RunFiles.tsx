'use client';

import Link from 'next/link';
import { Badge, Button, FileIcon, Icon } from '@/components/ui';
import { useDownload } from '@/lib/download';
import { fmtMonth, fmtSize, plural } from '@/lib/format';
import type { Country, ExportFile } from '@/lib/types';

// {CC}_{YYYY-MM}.csv or {CC}_{YYYY-MM}_part{N}.csv
const RUN_FILE_RE = /^([A-Z]{2,3})_(\d{4}-\d{2})(?:_part(\d+))?\./i;

/**
 * The files a run saved, grouped by country and month (a big month comes in parts): each file
 * with its size from storage and a download, each month and the whole run as one zip. Files
 * deleted since are marked Deleted; each country links to all of its files. `stored` is null
 * when storage couldn't be listed (every file is then offered).
 */
export function RunFiles({ files, stored, countries }: { files: string[]; stored: ExportFile[] | null; countries: Country[] }) {
  const { busy, download } = useDownload();
  if (!files.length) return null;

  const rows = [...files].sort().map((path) => {
    const name = path.split('/').pop() ?? path;
    const m = name.match(RUN_FILE_RE);
    const code = m?.[1].toUpperCase();
    return {
      path,
      name,
      code,
      country: code ? (countries.find((c) => c.code === code)?.name ?? code) : '',
      period: m?.[2] ?? null,
      part: m?.[3] ? Number(m[3]) : null,
      stored: stored?.find((f) => f.relativePath === path),
    };
  });
  type Row = (typeof rows)[number];
  const isAvailable = (r: Row) => Boolean(r.stored) || stored === null;
  const available = rows.filter(isAvailable);
  const sizeOf = (list: Row[]) => list.reduce((n, r) => n + (r.stored?.sizeBytes ?? 0), 0);
  const total = sizeOf(rows);
  const deleted = rows.length - available.length;
  const codes = [...new Map(rows.filter((r) => r.code).map((r) => [r.code!, r.country])).entries()];
  // One group per country and month, in the order the files sort
  const groups = [...new Map(rows.map((r) => [`${r.country}|${r.period}`, rows.filter((x) => x.country === r.country && x.period === r.period)])).values()];

  return (
    <section className="run-files" aria-label="Files saved">
      <div className="run-files-head">
        <div>
          <h3 className="run-files-title">Files saved</h3>
          <p className="panel-desc">
            {plural(files.length, 'file')}
            {total ? ` · ${fmtSize(total)}` : ''}
            {rows.some((r) => r.part) ? ' · large months are split into parts' : ''}
            {deleted ? ` · ${deleted === rows.length ? 'all' : deleted} deleted` : ''}
          </p>
        </div>
        <div className="inline-form">
          {codes.map(([code, name]) => (
            <Link key={code} href={files.every((p) => p.startsWith('_test/')) ? `/files?test=${code}` : `/files?country=${code}`} className="btn btn-ghost btn-sm">
              {codes.length > 1 ? `All ${name} files` : 'See all files'} <Icon.ChevronRight size={13} />
            </Link>
          ))}
          {available.length > 1 && (
            <Button size="sm" variant="secondary" icon={<Icon.Download size={14} />} loading={busy === 'all'} onClick={() => download(available.map((r) => r.path), 'all')}>
              Download all (zip)
            </Button>
          )}
        </div>
      </div>
      {deleted === rows.length && (
        <div className="note note-warn note-tight">
          <Icon.Trash size={14} />
          <span>{rows.length === 1 ? 'This file was deleted' : 'These files were deleted'} from storage. Extract the months again to recreate them.</span>
        </div>
      )}
      <div className="month-list">
        {groups.map((group) => {
          const first = group[0];
          const key = `${first.country}|${first.period}`;
          const ready = group.filter(isAvailable);
          const parts = group.filter((r) => r.part).length;
          return (
            <section key={key} className="month-group">
              <header className="month-group-head">
                <span className="month-group-name">{[first.country, first.period && fmtMonth(first.period)].filter(Boolean).join(' · ') || 'Other files'}</span>
                <span className="month-group-meta">
                  {parts ? `${plural(parts, 'part')} · ` : ''}
                  {sizeOf(group) ? fmtSize(sizeOf(group)) : ''}
                </span>
                {ready.length > 1 && (
                  <span className="month-group-actions">
                    <Button size="sm" variant="ghost" icon={<Icon.Download size={14} />} loading={busy === key} onClick={() => download(ready.map((r) => r.path), key)}>
                      Month (zip)
                    </Button>
                  </span>
                )}
              </header>
              <ul className="file-list">
                {group.map((r) => {
                  const gone = !isAvailable(r);
                  return (
                    <li key={r.path} className={`file-row ${gone ? 'is-gone' : ''}`}>
                      <FileIcon name={r.name} />
                      <span className="file-row-text" title={r.path}>
                        <span className="file-row-name">
                          {r.name}{' '}
                          {gone && (
                            <Badge tone="red" dot>
                              Deleted
                            </Badge>
                          )}
                        </span>
                        <span className="file-row-meta">
                          {[r.part && `Part ${r.part} of ${parts}`, r.stored ? fmtSize(r.stored.sizeBytes) : gone ? 'Removed from storage' : 'Whole month'].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {!gone && (
                        <Button size="sm" variant="ghost" iconOnly aria-label={`Download ${r.name}`} title="Download" loading={busy === r.path} icon={<Icon.Download size={16} />} onClick={() => download([r.path])} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
