'use client';

import Link from 'next/link';
import { Badge, Button, FileIcon, Icon } from '@/components/ui';
import { useDownload } from '@/lib/download';
import { fmtMonth, fmtSize, plural } from '@/lib/format';
import { useServerFiles } from '@/lib/server-files';
import type { Country, ExportFile } from '@/lib/types';

// {CC}_{YYYY-MM}_{FLOW}.zip or {CC}_{YYYY-MM}_{FLOW}_part{N}.zip; runs from before files were kept per flow: {CC}_{YYYY-MM}[_part{N}].csv
const RUN_FILE_RE = /^([A-Z]{2,3})_(\d{4}-\d{2})(?:_(IMPORT|EXPORT))?(?:_part(\d+))?\./i;
const FLOW_LABEL: Record<string, string> = { IMPORT: 'Import', EXPORT: 'Export' };

/**
 * The files a run saved, grouped by country, month and flow (a big month comes in parts): each file
 * with its size from storage and a download, each month and the whole run as one zip. Files
 * deleted since are marked Deleted, and files the cloud couldn't take On server (they are kept on
 * the extraction service); each country links to all of its files. `stored` is null when storage
 * couldn't be listed (every file is then offered).
 */
export function RunFiles({ files, stored: cloud, countries }: { files: string[]; stored: ExportFile[] | null; countries: Country[] }) {
  const server = useServerFiles();
  const onServer = new Set(server.files.map((f) => f.relativePath));
  const { busy, download } = useDownload((p) => onServer.has(p) && !cloud?.some((f) => f.relativePath === p));
  if (!files.length) return null;
  const stored = cloud && [...cloud, ...server.files];

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
      flow: m?.[3] ? FLOW_LABEL[m[3].toUpperCase()] : null,
      part: m?.[4] ? Number(m[4]) : null,
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
  // One group per country, month and flow, in the order the files sort
  const groupKey = (r: Row) => `${r.country}|${r.period}|${r.flow}`;
  const groups = [...new Map(rows.map((r) => [groupKey(r), rows.filter((x) => groupKey(x) === groupKey(r))])).values()];

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
          const key = groupKey(first);
          const ready = group.filter(isAvailable);
          const parts = group.filter((r) => r.part).length;
          return (
            <section key={key} className="month-group">
              <header className="month-group-head">
                <span className="month-group-name">{[first.country, first.period && fmtMonth(first.period), first.flow].filter(Boolean).join(' · ') || 'Other files'}</span>
                <span className="month-group-meta">
                  {parts ? `${plural(parts, 'part')} · ` : ''}
                  {sizeOf(group) ? fmtSize(sizeOf(group)) : ''}
                </span>
                {ready.length > 1 && (
                  <span className="month-group-actions">
                    <Button size="sm" variant="ghost" icon={<Icon.Download size={14} />} loading={busy === key} onClick={() => download(ready.map((r) => r.path), key)}>
                      All parts (zip)
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
                          {r.stored?.location === 'server' && (
                            <Badge tone="amber" dot>
                              On server
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
