'use client';

// The data folder on this device (Chrome/Edge folder access), shared by the copy on Settings and
// runs saved to the device. Files are laid out as in storage: {CC}/{YYYY}/{MM}/{FLOW}/{file}.

export type Dir = FileSystemDirectoryHandle;
type Permission = { queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>; requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState> };
type Picker = (o: { id?: string; mode: 'readwrite' }) => Promise<Dir>;

/** Whether this browser can write to a folder the person picks */
export const canUseFolders = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// The chosen folder is kept in IndexedDB (a folder handle can't go in localStorage), so it needn't be picked each time
const DB = 'local-copy';
function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore('handles');
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        const req = fn(open.result.transaction('handles', mode).objectStore('handles'));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      };
    } catch {
      resolve(undefined);
    }
  });
}

/** Where this browser's new extractions save their files, set on Settings */
export type Destination = 'storage' | 'device';
const DESTINATION_KEY = 'extraction-destination';

/** This browser's choice; the database when unset, blocked, or folders can't be used here */
export function savedDestination(): Destination {
  try {
    return canUseFolders() && localStorage.getItem(DESTINATION_KEY) === 'device' ? 'device' : 'storage';
  } catch {
    return 'storage';
  }
}

export function saveDestination(value: Destination): void {
  try {
    localStorage.setItem(DESTINATION_KEY, value);
  } catch {
    // Storage blocked: extractions keep saving to the database
  }
}

/** The folder picked last time, if any */
export const savedFolder = () => withStore<Dir>('readonly', (s) => s.get('folder'));

/** Asks for a folder and remembers it; null when the picker was closed */
export async function pickFolder(): Promise<Dir | null> {
  try {
    const dir = await (window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker({ id: 'trade-data', mode: 'readwrite' });
    await withStore('readwrite', (s) => s.put(dir, 'folder'));
    return dir;
  } catch {
    return null;
  }
}

/** Whether files can be written there now; `ask` prompts (only from a click) when not yet allowed */
export async function hasAccess(dir: Dir, ask: boolean): Promise<boolean> {
  const perm = dir as unknown as Permission;
  if ((await perm.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return ask && (await perm.requestPermission({ mode: 'readwrite' })) === 'granted';
}

/** Folder handles by path under one root, so each folder is looked up (or made) once */
export type FolderCache = Map<string, Promise<Dir | null>>;

/** The folder at `path` under `root` ("THA/2026"), made when `create`; null when it isn't there */
export function folderAt(root: Dir, path: string, create: boolean, cache: FolderCache): Promise<Dir | null> {
  if (!path) return Promise.resolve(root);
  let found = cache.get(path);
  if (!found) {
    const cut = path.lastIndexOf('/');
    found = folderAt(root, cut < 0 ? '' : path.slice(0, cut), create, cache).then((dir) => dir?.getDirectoryHandle(path.slice(cut + 1), { create }).catch(() => null) ?? null);
    cache.set(path, found);
  }
  return found;
}

const splitPath = (path: string) => [path.slice(0, Math.max(0, path.lastIndexOf('/'))), path.slice(path.lastIndexOf('/') + 1)] as const;

/** Size of the file at `path` under `root`, or null when it isn't there */
export async function localSize(root: Dir, path: string, cache: FolderCache): Promise<number | null> {
  const [dirPath, name] = splitPath(path);
  const dir = await folderAt(root, dirPath, false, cache);
  const file = await dir?.getFileHandle(name).then((h) => h.getFile()).catch(() => null);
  return file?.size ?? null;
}

/**
 * Writes a download to `path` under `root`, making its folders. It goes to a temporary copy that
 * replaces the file only once complete, so a broken download never leaves half a file; a new
 * file that failed is removed.
 */
export async function writeFile(root: Dir, path: string, open: () => Promise<Response>, cache: FolderCache, signal: AbortSignal, onBytes: (n: number) => void): Promise<void> {
  const [dirPath, name] = splitPath(path);
  const dir = await folderAt(root, dirPath, true, cache);
  if (!dir) throw new Error(`could not make folder ${dirPath}`);
  const existed = await dir.getFileHandle(name).then(() => true, () => false);
  try {
    const res = await open();
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const out = await (await dir.getFileHandle(name, { create: true })).createWritable();
    const count = new TransformStream<Uint8Array, Uint8Array>({ transform: (chunk, c) => (onBytes(chunk.byteLength), c.enqueue(chunk)) });
    await res.body.pipeThrough(count).pipeTo(out, { signal });
  } catch (err) {
    if (!existed) await dir.removeEntry(name).catch(() => {});
    throw err;
  }
}

export const isZip = (path: string) => /\.zip$/i.test(path);

/** A path inside a zip made safe to write under a folder: no leading slash, "." or ".." */
const safeEntry = (name: string) =>
  name
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/');

/**
 * Writes a download to `path` under `root` like writeFile, except that a zip is unpacked: its
 * files go beside it ("THA/2026/THA_2026-09.zip" → "THA/2026/THA_2026-09.csv"), and the zip itself
 * isn't kept. Returns how many files were written.
 */
export async function writeUnpacked(root: Dir, path: string, open: () => Promise<Response>, cache: FolderCache, signal: AbortSignal, onBytes: (n: number) => void): Promise<number> {
  if (!isZip(path)) {
    await writeFile(root, path, open, cache, signal, onBytes);
    return 1;
  }
  const res = await open();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.arrayBuffer();
  onBytes(data.byteLength);
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(data);
  const folder = path.slice(0, path.lastIndexOf('/') + 1);
  const entries = Object.values(zip.files).filter((e) => !e.dir && safeEntry(e.name));
  for (const entry of entries) {
    if (signal.aborted) break;
    await writeFile(root, folder + safeEntry(entry.name), async () => new Response(await entry.async('blob')), cache, signal, () => {});
  }
  // A copy of the zip saved here before (when zips weren't unpacked) has done its job
  if (!signal.aborted && !entries.some((e) => safeEntry(e.name) === path.slice(folder.length))) {
    const [dirPath, name] = splitPath(path);
    await (await folderAt(root, dirPath, false, cache))?.removeEntry(name).catch(() => {});
  }
  return entries.length;
}

/**
 * Whether a stored file is already in the folder: the same size, or for a zip, its unpacked files
 * ("THA_2026-09.zip" → any "THA_2026-09.*" beside it; a zip re-extracted since isn't noticed).
 */
export async function isSaved(root: Dir, path: string, size: number, cache: FolderCache): Promise<boolean> {
  if (!isZip(path)) return (await localSize(root, path, cache)) === size;
  const [dirPath, name] = splitPath(path);
  const dir = await folderAt(root, dirPath, false, cache);
  if (!dir) return false;
  const base = `${name.slice(0, -4)}.`;
  for await (const entry of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) {
    if (entry.startsWith(base) && !isZip(entry)) return true;
  }
  return false;
}

/** Runs `task` on each item, `parallel` at a time, until done or stopped */
export async function eachLimited<T>(items: T[], parallel: number, signal: AbortSignal, task: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined && !signal.aborted; item = queue.shift()) await task(item);
  };
  await Promise.all(Array.from({ length: parallel }, worker));
}
