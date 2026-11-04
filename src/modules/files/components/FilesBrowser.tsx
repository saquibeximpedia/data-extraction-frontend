'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, CodeTag, ConfirmModal, Dock, Empty, FileIcon, Icon, Menu, revealStyle, SearchInput, When, type MenuItem } from '@/components/ui';
import { useDownload } from '@/lib/download';
import { displayName } from '@/lib/files';
import { fmtMonth, fmtNumber, fmtSize, plural } from '@/lib/format';
import { useAction, useChangedKeys } from '@/lib/hooks';
import { useServerFiles } from '@/lib/server-files';
import { unwrap } from '@/lib/result';
import type { Country, ExportFile, Share } from '@/lib/types';
import { extractor } from '@/modules/service/client';
import { deleteFiles } from '../actions';
import { useSaveToFolder } from '../hooks';
import { MergeModal } from './MergeModal';
import { ShareModal } from './ShareModal';
import { SharesList } from './SharesList';
import { UploadModal } from './UploadModal';

const RECENT = 'RECENT';
const SHARES = 'SHARES';
/** Files written by merges (under merged/) */
const MERGED = 'MERGED';
/** A country's test files are their own view ("TEST:EU"), apart from its real data */
const TEST = 'TEST:';

type ViewParams = { country?: string; view?: string; test?: string };

/** Supabase's free plan stores 1 GB; set NEXT_PUBLIC_STORAGE_LIMIT_MB for another plan */
const STORAGE_LIMIT = (Number(process.env.NEXT_PUBLIC_STORAGE_LIMIT_MB) || 1024) * 1048576;

const sizeOf = (files: ExportFile[]) => files.reduce((n, f) => n + f.sizeBytes, 0);
const pathsOf = (files: ExportFile[]) => files.map((f) => f.relativePath);
/** The sidebar entry a file belongs to: its country, its country's test files, or the merged files */
const groupOf = (f: ExportFile) => (f.origin === 'merged' ? MERGED : `${f.test ? TEST : ''}${f.countryCode ?? 'Other'}`);
/** Where a sidebar entry's folders start in storage */
const rootOf = (key: string) => (key === MERGED ? 'merged' : key.startsWith(TEST) ? `_test/${key.slice(TEST.length)}` : key);
const FLOW_LABEL = { IMPORT: 'Import', EXPORT: 'Export' } as const;

/** Folders newest first (years, months), Import before Export, anything else by name */
function folderOrder(a: string, b: string): number {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(b) - Number(a);
  const flows = ['IMPORT', 'EXPORT'];
  if (flows.includes(a) && flows.includes(b)) return flows.indexOf(a) - flows.indexOf(b);
  return a.localeCompare(b);
}

/** The view a link asks for: a country's files or test files, the merged files, the share links, or the recent files */
const viewOf = (params: ViewParams) =>
  params.view === 'shares' ? SHARES : params.view === 'merged' ? MERGED : params.test ? `${TEST}${params.test.toUpperCase()}` : (params.country?.toUpperCase() ?? RECENT);
const hrefOf = (view: string) =>
  view === RECENT ? '/files' : view === SHARES ? '/files?view=shares' : view === MERGED ? '/files?view=merged' : view.startsWith(TEST) ? `/files?test=${view.slice(TEST.length)}` : `/files?country=${view}`;

/** A month written in parts (_part1, _part2…): shown as one entry that opens to its parts */
interface PartSet {
  key: string;
  name: string;
  files: ExportFile[];
}

/** Files in order, with each month's parts gathered into one entry where its first part was */
function bundle(list: ExportFile[]): (ExportFile | PartSet)[] {
  const out: (ExportFile | PartSet)[] = [];
  const sets = new Map<string, PartSet>();
  for (const f of list) {
    if (!f.part) {
      out.push(f);
      continue;
    }
    const key = `${f.relativePath.split('/').slice(0, -1).join('/')}|${f.countryCode}|${f.period}`;
    let set = sets.get(key);
    if (!set) {
      set = { key, name: f.fileName.replace(/_part\d+(?=\.[^.]+$)/, ''), files: [] };
      sets.set(key, set);
      out.push(set);
    }
    set.files.push(f);
  }
  for (const set of sets.values()) set.files.sort((a, b) => (a.part ?? 0) - (b.part ?? 0));
  return out;
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

/** Marks a file kept on the extraction service instead of the cloud */
function ServerBadge() {
  return (
    <span title="Too big for the cloud, or its upload failed: kept on the extraction service until deleted here. Downloads come from the service, so it must be running; share links can't include it.">
      <Badge tone="amber" dot>
        On server
      </Badge>
    </span>
  );
}

/** How much of the storage plan the files take */
function StorageMeter({ used }: { used: number }) {
  const pct = Math.min(100, (used / STORAGE_LIMIT) * 100);
  const tone = pct >= 95 ? 'red' : pct >= 80 ? 'amber' : '';
  return (
    <div className={`storage ${tone}`} title={`${fmtSize(used)} of ${fmtSize(STORAGE_LIMIT)} (${pct.toFixed(1)}%)`}>
      <div className="storage-head">
        <span className="storage-label">
          <Icon.Storage size={14} /> Storage used
        </span>
        <span className="storage-value">{`${fmtSize(used)} of ${fmtSize(STORAGE_LIMIT)}`}</span>
      </div>
      <div className="meter" role="meter" aria-label="Storage used" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${Math.max(pct, used ? 1 : 0)}%` }} />
      </div>
    </div>
  );
}

/**
 * Stored files: countries in a sidebar, a country's folders as they are stored (year → month →
 * import/export), merged files, recent files and share links, search, and multi-select of files
 * and folders to download, share, merge or delete. The view is kept in the link without
 * reloading the page.
 */
export function FilesBrowser({
  files: cloudFiles,
  filesError,
  countries,
  shares,
  sharesError,
  params,
}: {
  /** Files in Storage (those kept on the extraction service are listed from this browser) */
  files: ExportFile[];
  filesError: string;
  countries: Country[];
  shares: Share[];
  sharesError: string;
  /** The link's ?country=, ?test= or ?view=shares */
  params: ViewParams;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const server = useServerFiles();
  // Files kept on the server beside the stored ones, newest first; one in both places shows once, from the cloud
  const files = useMemo(() => {
    const inCloud = new Set(pathsOf(cloudFiles));
    return [...cloudFiles, ...server.files.filter((f) => !inCloud.has(f.relativePath))].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }, [cloudFiles, server.files]);
  const onServer = useMemo(() => new Set(pathsOf(files.filter((f) => f.location === 'server'))), [files]);
  const isOnServer = (path: string) => onServer.has(path);
  /** Share links serve files from storage, so files kept on the server can't be shared */
  const shareable = (paths: string[]) => paths.filter((p) => !isOnServer(p));
  const changed = useChangedKeys(files.map((f) => ({ key: f.relativePath, signature: f.modifiedAt })));
  const { busy, download } = useDownload(isOnServer);
  const folder = useSaveToFolder(isOnServer);
  const { busy: deleting, run } = useAction();

  const [view, setViewState] = useState(() => viewOf(params));
  const [query, setQuery] = useState('');
  // The open folder, below the view's root (e.g. ["2026", "09", "IMPORT"])
  const [dir, setDir] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const [toShare, setToShare] = useState<string[] | null>(null);
  const [toMerge, setToMerge] = useState<ExportFile[] | null>(null);
  const [uploading, setUploading] = useState(false);
  // Split months opened to show their parts
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;

  // Countries with files, by name; each country's test files are a group of their own, and so are merged files
  const groups = useMemo(() => {
    const map = new Map<string, ExportFile[]>();
    for (const f of files) map.set(groupOf(f), [...(map.get(groupOf(f)) ?? []), f]);
    return [...map.entries()]
      .map(([key, list]) => ({ key, code: key === MERGED ? MERGED : (list[0].countryCode ?? 'Other'), test: list[0].test, files: list }))
      .sort((a, b) => countryName(a.code).localeCompare(countryName(b.code)));
  }, [files, countries]);
  const realGroups = groups.filter((g) => !g.test && g.key !== MERGED);
  const testGroups = groups.filter((g) => g.test);
  const mergedGroup = groups.find((g) => g.key === MERGED);

  const setView = (next: string) => {
    setDir([]);
    setQuery('');
    setViewState(next);
    // Next keeps its router in step with history calls, without fetching the page again
    window.history.replaceState(null, '', hrefOf(next));
  };
  const group = groups.find((g) => g.key === view);

  // Search matches the file name, its path, the country and the month as written ("Aug 2026")
  const q = query.trim().toLowerCase();
  const results = useMemo(
    () => (q ? files.filter((f) => [f.fileName, f.relativePath, f.countryCode ? countryName(f.countryCode) : '', f.period ? fmtMonth(f.period) : ''].join(' ').toLowerCase().includes(q)) : []),
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

  function confirmDelete() {
    if (!toDelete) return;
    const paths = toDelete;
    // Each file is removed where it is: storage, or the server
    const remove = async () => {
      const there = paths.filter(isOnServer);
      const cloud = paths.filter((p) => !isOnServer(p));
      const deleted = cloud.length ? await unwrap(deleteFiles(cloud)) : [];
      if (there.length) {
        await extractor.deleteServerFiles(there);
        await server.refresh();
      }
      return [...deleted, ...there];
    };
    run(remove, (deleted) => `Deleted ${plural(deleted.length, 'file')}`, () => {
      toggle(paths, false);
      setToDelete(null);
    }, 'Could not delete');
  }

  /** "Share link" in a menu, for the files that are in storage */
  const shareItem = (paths: string[]): MenuItem[] => {
    const ok = shareable(paths);
    return ok.length ? [{ label: ok.length < paths.length ? `Share link (${plural(ok.length, 'file')} in the cloud)` : 'Share link', icon: <Icon.Link size={15} />, onSelect: () => setToShare(ok) }] : [];
  };

  /** "Save to folder" in a menu, where this browser can write to a folder */
  const saveItem = (paths: string[], key = paths.join('|')): MenuItem[] =>
    folder.supported ? [{ label: 'Save to folder', icon: <Icon.Folder size={15} />, onSelect: () => folder.save(paths, key) }] : [];

  const fileActions = (f: ExportFile): MenuItem[] => [
    ...(isOnServer(f.relativePath) ? [] : [{ label: 'Share link', icon: <Icon.Link size={15} />, onSelect: () => setToShare([f.relativePath]) }]),
    ...saveItem([f.relativePath]),
    { label: 'Delete file', icon: <Icon.Trash size={15} />, separator: true, danger: true, onSelect: () => setToDelete([f.relativePath]) },
  ];

  /** "European Union · Aug 2026 · Import · " in front of a file's facts, outside its country's view */
  const where = (f: ExportFile) =>
    f.origin === 'merged' ? (
      <>
        <b>Merged</b> ·{' '}
      </>
    ) : (
      f.countryCode && (
        <>
          <b>{countryName(f.countryCode)}</b> · {f.period ? fmtMonth(f.period) : 'Other'} · {f.flow ? `${FLOW_LABEL[f.flow]} · ` : ''}
          {f.test ? 'Test run · ' : ''}
        </>
      )
    );

  /** Merge, in a menu, for files that include extracted ones */
  const mergeItem = (list: ExportFile[]): MenuItem[] => (list.some((f) => f.origin === 'extracted') ? [{ label: 'Merge into one file', icon: <Icon.Merge size={15} />, onSelect: () => setToMerge(list) }] : []);

  /** One file: icon, name, facts, actions; in select mode the whole row toggles it. `of` is the parts it belongs to. */
  const fileRow = (f: ExportFile, showWhere = false, of?: PartSet) => {
    const isSelected = selected.has(f.relativePath);
    return (
      <li
        key={f.relativePath}
        className={`file-row ${of ? 'file-part' : ''} ${selecting ? 'selectable' : ''} ${isSelected ? 'selected' : ''} ${changed.has(f.relativePath) ? 'flash' : ''}`}
        onClick={selecting ? () => toggle([f.relativePath], !isSelected) : undefined}
      >
        {selecting && <Check {...checkFor([f.relativePath], `Select ${f.fileName}`)} />}
        <FileIcon name={f.fileName} />
        <span className="file-row-text" title={f.relativePath}>
          <span className="file-row-name">
            {f.origin === 'uploaded' ? displayName(f.fileName) : f.fileName}{' '}
            {f.location === 'server' && <ServerBadge />}
          </span>
          <span className="file-row-meta">
            {showWhere && where(f)}
            {of ? `Part ${f.part} of ${of.files.length} · ` : ''}
            {fmtSize(f.sizeBytes)} · <When value={f.modifiedAt} as="relative" title />
            {f.uploadedBy ? ` · by ${f.uploadedBy}` : ''}
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

  /**
   * A month stored in parts, as one entry: downloads, shares or deletes them together, and opens
   * to list each part. In select mode it selects every part.
   */
  const partsRow = (set: PartSet, showWhere = false) => {
    const paths = pathsOf(set.files);
    const open = expanded.has(set.key);
    const latest = set.files.reduce((a, b) => (b.modifiedAt > a.modifiedAt ? b : a));
    const toggleOpen = () =>
      setExpanded((prev) => {
        const next = new Set(prev);
        open ? next.delete(set.key) : next.add(set.key);
        return next;
      });
    const isSelected = paths.every((p) => selected.has(p));
    return [
      <li
        key={set.key}
        className={`file-row file-parts selectable ${isSelected ? 'selected' : ''} ${set.files.some((f) => changed.has(f.relativePath)) ? 'flash' : ''}`}
        onClick={selecting ? () => toggle(paths, !isSelected) : toggleOpen}
      >
        {selecting && <Check {...checkFor(paths, `Select every part of ${set.name}`)} />}
        <FileIcon name={set.name} />
        <span className="file-row-text" title={`${plural(set.files.length, 'part')}: ${paths.join(', ')}`}>
          <span className="file-row-name">{set.name}</span>
          <span className="file-row-meta">
            {showWhere && where(latest)}
            <b>{plural(set.files.length, 'part')}</b> · {fmtSize(sizeOf(set.files))} · <When value={latest.modifiedAt} as="relative" title />
          </span>
        </span>
        <span className="file-row-actions" onClick={(e) => e.stopPropagation()}>
          {!selecting && (
            <>
              <Button size="sm" variant="ghost" iconOnly aria-label={`Download every part of ${set.name} as a zip`} title="Download all parts (zip)" loading={busy === set.key} icon={<Icon.Download size={16} />} onClick={() => download(paths, set.key)} />
              <Menu
                label="Options"
                items={[
                  ...shareItem(paths),
                  ...saveItem(paths, set.key),
                  { label: `Delete all ${set.files.length} parts`, icon: <Icon.Trash size={15} />, separator: true, danger: true, onSelect: () => setToDelete(paths) },
                ]}
              />
            </>
          )}
          <Button size="sm" variant="ghost" iconOnly aria-label={open ? 'Hide the parts' : 'Show the parts'} aria-expanded={open} title={open ? 'Hide the parts' : 'Show the parts'} className={`parts-toggle ${open ? 'open' : ''}`} icon={<Icon.ChevronDown size={16} />} onClick={toggleOpen} />
        </span>
      </li>,
      open ? (
        <li key={`${set.key}|parts`} className="file-parts-list">
          <ul className="file-list">{set.files.map((f) => fileRow(f, false, set))}</ul>
        </li>
      ) : null,
    ];
  };

  /** Files as rows, a split month as one entry */
  const rows = (list: ExportFile[], showWhere = false) => bundle(list).flatMap((item) => ('files' in item ? partsRow(item, showWhere) : [fileRow(item, showWhere)]));

  /**
   * One folder: opens it, or in select mode selects every file in it at any depth. Downloads,
   * shares, saves, merges or deletes them together.
   */
  const folderRow = (name: string, inside: ExportFile[], at: string[]) => {
    const paths = pathsOf(inside);
    const isSelected = paths.every((p) => selected.has(p));
    const key = `folder|${[...at, name].join('/')}`;
    const label = FLOW_LABEL[name as keyof typeof FLOW_LABEL] ?? name;
    return (
      <li key={key} className={`file-row file-parts selectable ${isSelected && selecting ? 'selected' : ''}`} onClick={selecting ? () => toggle(paths, !isSelected) : () => setDir([...at, name])}>
        {selecting && <Check {...checkFor(paths, `Select everything in ${label}`)} />}
        <Icon.Folder size={20} />
        <span className="file-row-text" title={[rootOf(group!.key), ...at, name].join('/')}>
          <span className="file-row-name">{label}</span>
          <span className="file-row-meta">
            {plural(inside.length, 'file')} · {fmtSize(sizeOf(inside))} · <When value={inside.reduce((a, b) => (b.modifiedAt > a.modifiedAt ? b : a)).modifiedAt} as="relative" title />
          </span>
        </span>
        {!selecting && (
          <span className="file-row-actions" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" iconOnly aria-label={`Download ${label} as a zip`} title="Download (zip)" loading={busy === key} icon={<Icon.Download size={16} />} onClick={() => download(paths, key)} />
            <Menu
              label="Folder options"
              items={[
                ...mergeItem(inside),
                ...shareItem(paths),
                ...saveItem(paths, key),
                { label: `Delete ${plural(inside.length, 'file')}`, icon: <Icon.Trash size={15} />, separator: true, danger: true, onSelect: () => setToDelete(paths) },
              ]}
            />
          </span>
        )}
      </li>
    );
  };

  /** The open folder's subfolders (newest first), then its own files */
  function folderList(here: string, inside: ExportFile[], at: string[]) {
    const subfolders = new Map<string, ExportFile[]>();
    const direct: ExportFile[] = [];
    for (const f of inside) {
      const rest = f.relativePath.slice(here.length + 1).split('/');
      if (rest.length > 1) subfolders.set(rest[0], [...(subfolders.get(rest[0]) ?? []), f]);
      else direct.push(f);
    }
    direct.sort((a, b) => (a.part ?? 0) - (b.part ?? 0) || a.fileName.localeCompare(b.fileName));
    return (
      <ul className="file-list">
        {[...subfolders.keys()].sort(folderOrder).map((name) => folderRow(name, subfolders.get(name)!, at))}
        {rows(direct)}
      </ul>
    );
  }

  // ---------------------------------------------------------------- main area

  // `filter` sits beside the search box
  let head: { title: React.ReactNode; desc: React.ReactNode; visible: ExportFile[]; filter?: React.ReactNode };
  let body: React.ReactNode;

  if (q) {
    head = { title: 'Search results', desc: `${plural(results.length, 'file')} match “${query.trim()}”`, visible: results.slice(0, 200) };
    body = results.length ? <ul className="file-list">{rows(results.slice(0, 200), true)}</ul> : <Empty>No files match.</Empty>;
  } else if (view === SHARES) {
    head = { title: 'Shared links', desc: 'Links anyone can open to download files, without signing in', visible: [] };
    body = <SharesList shares={shares} error={sharesError} />;
  } else if (!group) {
    // Test files stay in their own section
    const recent = files.filter((f) => !f.test).slice(0, 30);
    head = { title: 'Recent files', desc: `The latest ${recent.length} added or replaced, across every country`, visible: recent };
    body = recent.length ? <ul className="file-list">{rows(recent, true)}</ul> : <Empty>No files yet. They appear here once an extraction saves them.</Empty>;
  } else {
    const root = rootOf(group.key);
    // A folder emptied since (e.g. its files deleted) falls back to the nearest one still there
    let depth = dir.length;
    while (depth > 0 && !group.files.some((f) => f.relativePath.startsWith(`${[root, ...dir.slice(0, depth)].join('/')}/`))) depth--;
    const open = dir.slice(0, depth);
    const here = [root, ...open].join('/');
    const inside = group.files.filter((f) => f.relativePath.startsWith(`${here}/`));
    const merged = group.key === MERGED;

    head = {
      title: (
        <span className="title-with-code">
          {merged ? 'Merged files' : countryName(group.code)} {!merged && group.code !== 'Other' && <CodeTag code={group.code} />}
          {group.test && <Badge tone="amber">Test files</Badge>}
        </span>
      ),
      desc: (
        <>
          {group.test ? 'From runs on the test HS codes, kept apart from the real data · ' : merged ? 'Made with Merge from extracted files · ' : ''}
          {plural(inside.length, 'file')} · {fmtSize(sizeOf(inside))}
          {open.length > 0 && (
            <span className="crumbs" role="navigation" aria-label="Folder">
              {[merged ? 'Merged' : countryName(group.code), ...open.map((s) => FLOW_LABEL[s as keyof typeof FLOW_LABEL] ?? s)].map((label, i) => (
                <span key={i}>
                  {i > 0 && <Icon.ChevronRight size={12} />}
                  {i < open.length ? (
                    <button type="button" className="crumb" onClick={() => setDir(open.slice(0, i))}>
                      {label}
                    </button>
                  ) : (
                    <b>{label}</b>
                  )}
                </span>
              ))}
            </span>
          )}
        </>
      ),
      visible: inside,
    };
    body = inside.length ? folderList(here, inside, open) : <Empty>This folder is empty.</Empty>;
  }

  const sideItem = (g: (typeof groups)[number]) => (
    <button key={g.key} type="button" className={`side-item ${group?.key === g.key && !q ? 'active' : ''}`} onClick={() => setView(g.key)} title={`${plural(g.files.length, 'file')} · ${fmtSize(sizeOf(g.files))}`}>
      <Icon.Folder size={15} />
      <span className="side-name">{countryName(g.code)}</span>
      <span className="side-meta">{fmtSize(sizeOf(g.files))}</span>
    </button>
  );

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
      {server.error && (
        <div className="note note-warn note-tight" role="status">
          <Icon.Alert />
          <span>
            <b>Files kept on the extraction service are not shown</b> (the ones the cloud couldn&apos;t take): {server.error}
          </span>
        </div>
      )}
      <div className="files-layout reveal" style={revealStyle(1)}>
        <aside className="files-side" aria-label="Countries">
          <Button variant="primary" icon={<Icon.Upload size={15} />} onClick={() => setUploading(true)}>
            Upload files
          </Button>
          <StorageMeter used={sizeOf(cloudFiles)} />
          {onServer.size > 0 && (
            <span className="side-meta padded-side" title="Files the cloud couldn't take, kept on the extraction service until deleted here">
              {plural(onServer.size, 'file')} on the server · {fmtSize(sizeOf(files.filter((f) => f.location === 'server')))}
            </span>
          )}

          <nav className="side-list">
            <button type="button" className={`side-item ${view === RECENT && !q ? 'active' : ''}`} onClick={() => setView(RECENT)}>
              <Icon.Clock size={15} />
              <span className="side-name">Recent</span>
              <span className="side-meta">{fmtNumber(files.length)}</span>
            </button>
            <button type="button" className={`side-item ${view === SHARES && !q ? 'active' : ''}`} onClick={() => setView(SHARES)}>
              <Icon.Link size={15} />
              <span className="side-name">Shared links</span>
            </button>
            {mergedGroup && (
              <button type="button" className={`side-item ${view === MERGED && !q ? 'active' : ''}`} onClick={() => setView(MERGED)} title={`${plural(mergedGroup.files.length, 'file')} · ${fmtSize(sizeOf(mergedGroup.files))}`}>
                <Icon.Merge size={15} />
                <span className="side-name">Merged</span>
                <span className="side-meta">{fmtSize(sizeOf(mergedGroup.files))}</span>
              </button>
            )}
            <span className="side-label">Countries</span>
            {realGroups.map(sideItem)}
            {realGroups.length === 0 && <span className="side-meta padded-side">No files yet</span>}
            {testGroups.length > 0 && (
              <>
                <span className="side-label" title="Files from runs on the test HS codes, kept apart from the real data">
                  Test files
                </span>
                {testGroups.map(sideItem)}
              </>
            )}
          </nav>

          <Button size="sm" variant="ghost" icon={<Icon.Refresh size={14} />} loading={refreshing} onClick={() => {
            void server.refresh();
            startRefresh(() => router.refresh());
          }} className="side-refresh">
            Refresh
          </Button>
        </aside>

        <section className="files-main">
          <div className="files-main-head">
            <div>
              <h2 className="panel-title">{head.title}</h2>
              <p className="panel-desc">{head.desc}</p>
            </div>
            <div className="inline-form files-tools">
              <SearchInput value={query} onChange={setQuery} placeholder="Search files" className="search-sm" />
              {!q && head.filter}
            </div>
          </div>
          {head.visible.length > 0 && (
            <div className="files-subbar">
              {selecting ? (
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
              )}
            </div>
          )}
          {body}
        </section>
      </div>

      <Dock open={selected.size > 0}>
        <span className="bulk-text">
          <b>{plural(selected.size, 'file')}</b> · {fmtSize(sizeOf(selectedFiles))}
        </span>
        <Button variant="primary" size="sm" icon={<Icon.Download size={14} />} loading={busy === 'selection'} onClick={() => download([...selected], 'selection')}>
          {selected.size === 1 ? 'Download' : 'Download zip'}
        </Button>
        {selectedFiles.some((f) => f.origin === 'extracted') && (
          <Button variant="secondary" size="sm" icon={<Icon.Merge size={14} />} onClick={() => setToMerge(selectedFiles)} title="Merge the selected extracted files into one dataset">
            Merge
          </Button>
        )}
        {shareable([...selected]).length > 0 && (
          <Button variant="secondary" size="sm" icon={<Icon.Link size={14} />} onClick={() => setToShare(shareable([...selected]))} title={shareable([...selected]).length < selected.size ? 'Files kept on the server are left out of share links' : undefined}>
            Share link
          </Button>
        )}
        {folder.supported && (
          <Button variant="secondary" size="sm" icon={<Icon.Folder size={14} />} loading={folder.busy === 'selection'} onClick={() => folder.save([...selected], 'selection')} title="Save into your data folder, in the same folders as in storage, with zips unpacked">
            {folder.busy === 'selection' ? `Saving ${folder.progress.done} of ${folder.progress.total}` : 'Save to folder'}
          </Button>
        )}
        <Button variant="secondary" size="sm" className="btn-danger-ghost" icon={<Icon.Trash size={14} />} onClick={() => setToDelete([...selected])}>
          Delete
        </Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Clear selection" icon={<Icon.X size={14} />} onClick={() => setSelected(new Set())} />
      </Dock>

      <UploadModal open={uploading} onClose={() => setUploading(false)} countries={countries} initialCode={group && !group.test && group.key !== MERGED && group.code !== 'Other' ? group.code : undefined} />
      {/* Once the link is made the selection has done its job; closing without one keeps it */}
      <ShareModal paths={toShare} onClose={() => setToShare(null)} onCreated={stopSelecting} />
      <MergeModal
        files={toMerge}
        onClose={() => setToMerge(null)}
        onDone={() => {
          stopSelecting();
          // A merge too big for the cloud is kept on the server
          void server.refresh();
        }}
      />
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
