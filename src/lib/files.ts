// Stored files, shared by the browser and the server

import type { ExportFile } from './types';

/** Files of runs on the test HS codes sit under this top folder, apart from the real data */
export const TEST_FOLDER = '_test';
/** Files written by merges: merged/{name}/{name}.zip or {name}_part{N}.zip */
export const MERGED_FOLDER = 'merged';

// {CC}_{YYYY-MM}_{FLOW}.zip or {CC}_{YYYY-MM}_{FLOW}_part{N}.zip (extracted)
const EXTRACTED_RE = /^([A-Z]{2,3})_(\d{4}-\d{2})_(IMPORT|EXPORT)(?:_part(\d+))?\.(csv|zip)$/i;
// {CC}_{YYYY-MM}__{original name} (uploaded)
const UPLOADED_RE = /^([A-Z]{2,3})_(\d{4}-\d{2})__.+$/i;
const PART_RE = /_part(\d+)\.[a-z0-9]+$/i;

/** What a stored file is, from its path: the same in the cloud and on the server */
export function describe(relativePath: string): Pick<ExportFile, 'countryCode' | 'period' | 'flow' | 'origin' | 'part' | 'test'> {
  const test = relativePath.startsWith(`${TEST_FOLDER}/`);
  const name = relativePath.split('/').pop() ?? '';
  const none = { countryCode: null, period: null, flow: null, part: null, test };
  if (relativePath.startsWith(`${MERGED_FOLDER}/`)) {
    const part = name.match(PART_RE)?.[1];
    return { ...none, origin: 'merged', part: part ? Number(part) : null };
  }
  const e = name.match(EXTRACTED_RE);
  if (e) return { countryCode: e[1].toUpperCase(), period: e[2], flow: e[3].toUpperCase() as 'IMPORT' | 'EXPORT', origin: 'extracted', part: e[4] ? Number(e[4]) : null, test };
  const u = name.match(UPLOADED_RE);
  if (u) return { ...none, countryCode: u[1].toUpperCase(), period: u[2], origin: 'uploaded' };
  return { ...none, origin: 'uploaded' };
}

/** Uploaded files are stored as "{CC}_{YYYY-MM}__{original name}"; people see the original name */
export const displayName = (fileName: string) => (fileName.includes('__') ? fileName.split('__').slice(1).join('__') : fileName);

/** What can be uploaded, by extension */
export const UPLOAD_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  zip: 'application/zip',
};

export const UPLOAD_ACCEPT = Object.keys(UPLOAD_TYPES).map((ext) => `.${ext}`).join(',');
export const isUploadable = (name: string) => Boolean(UPLOAD_TYPES[name.split('.').pop()?.toLowerCase() ?? '']);
