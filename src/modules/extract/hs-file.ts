/** File types the HS code box reads, for the file picker */
export const HS_FILE_ACCEPT = '.csv,.txt,.xlsx';

/** The HS code in one cell: digits only once quotes, = (Excel formulas), dots and spaces are gone */
function codeOf(cell: string): string | null {
  const code = cell.replace(/["'=.\s]/g, '');
  return /^\d{2,12}$/.test(code) ? code : null;
}

/** First cell of each line of a CSV or text file (headers and descriptions are skipped) */
function fromText(text: string): string[] {
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line) => codeOf(line.trim().split(/[,;\t]/)[0] ?? ''))
    .filter((c): c is string => c !== null);
}

/** Column A of the workbook's first sheet */
async function fromXlsx(data: ArrayBuffer): Promise<string[]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(data);
  const sheetPath = Object.keys(zip.files)
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0];
  if (!sheetPath) throw new Error('This workbook has no sheets.');
  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
  const strings = zip.file('xl/sharedStrings.xml');
  const shared = strings ? [...parse(await strings.async('text')).getElementsByTagName('si')].map((si) => si.textContent ?? '') : [];

  const out: string[] = [];
  for (const cell of parse(await zip.file(sheetPath)!.async('text')).getElementsByTagName('c')) {
    if (!/^A\d+$/.test(cell.getAttribute('r') ?? '')) continue;
    const type = cell.getAttribute('t');
    const raw = type === 'inlineStr' ? (cell.getElementsByTagName('is')[0]?.textContent ?? '') : (cell.getElementsByTagName('v')[0]?.textContent ?? '');
    const code = codeOf(type === 's' ? (shared[Number(raw)] ?? '') : raw);
    if (code) out.push(code);
  }
  return out;
}

/** The distinct HS codes in a .csv, .txt or .xlsx file: its first column, in file order */
export async function readHsFile(file: File): Promise<string[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'xls') throw new Error('Old .xls workbooks can’t be read here: save it as .xlsx or .csv first.');
  const codes = ext === 'xlsx' ? await fromXlsx(await file.arrayBuffer()) : fromText(await file.text());
  return [...new Set(codes)];
}
