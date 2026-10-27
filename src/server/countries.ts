import { z } from 'zod';
import type { Country, CountryPatch, ExtractorInfo, MonthChange } from '@/lib/types';
import { recentPublishedPeriods } from '@/lib/months';
import { badRequest, conflict, notFound, result } from './http';
import { admin } from './supabase';

const MANUAL_METHOD = 'The source publishes files; download them from its website and upload them here.';
const MANUAL_OUTPUT = 'The files exactly as downloaded from the source.';

interface ConfigRow {
  code: string;
  kind: 'api' | 'manual';
  /** Admins' edits (for 'api') or the whole country (for 'manual') */
  data: CountryPatch;
  updated_at: string | null;
  updated_by: string | null;
  extractor: ExtractorInfo | null;
  extractor_synced_at: string | null;
}

interface MonthRow {
  country_code: string;
  period: string;
  status: 'extracting' | 'completed';
  marked_at: string;
}

function build(row: ConfigRow, months: MonthRow[], lastExtractedAt: string | undefined): Country {
  const base = row.extractor;
  const edit = row.data ?? {};
  const completed = months.filter((m) => m.status === 'completed').map((m) => m.period);
  const lagMonths = edit.lagMonths ?? base?.lagMonths ?? 1;
  const publishDay = edit.publishDay ?? base?.publishDay ?? 1;
  const defaultStartPeriod = base?.startPeriod ?? null;
  const startPeriod = edit.startPeriod || defaultStartPeriod;
  return {
    code: row.code,
    name: edit.name || base?.name || row.code,
    kind: row.kind,
    enabled: row.kind === 'manual' ? true : Boolean(base?.enabled),
    missingConfig: base?.missingConfig ?? [],
    source: {
      name: edit.sourceName || base?.source.name || '',
      url: edit.sourceUrl || base?.source.url || '',
      endpoint: edit.endpoint ?? base?.source.endpoint ?? '',
      method: edit.method || base?.source.method || (row.kind === 'manual' ? MANUAL_METHOD : ''),
      output: edit.output || base?.source.output || (row.kind === 'manual' ? MANUAL_OUTPUT : ''),
    },
    notes: edit.notes ?? '',
    lagMonths,
    defaultLagMonths: base?.lagMonths ?? lagMonths,
    publishDay,
    startPeriod,
    defaultStartPeriod,
    tradeTypes: base?.tradeTypes ?? [],
    hsCodeHint: base?.hsCodeHint ?? '',
    hsCodeCount: base?.hsCodeCount ?? 0,
    testHsCodeCount: base?.testHsCodeCount ?? 0,
    recentPeriods: recentPublishedPeriods(lagMonths, publishDay, 12).filter((p) => !startPeriod || p >= startPeriod),
    completedMonths: completed,
    extractingMonths: months.filter((m) => m.status === 'extracting').map((m) => m.period),
    latestCompleted: completed[completed.length - 1] ?? null,
    lastExtractedAt: lastExtractedAt ?? null,
    lastUpdatedAt: [lastExtractedAt, ...months.map((m) => m.marked_at)].filter(Boolean).sort().pop() ?? null,
    updatedAt: Object.keys(edit).length ? row.updated_at : null,
    updatedBy: Object.keys(edit).length ? row.updated_by : null,
    extractorSyncedAt: row.extractor_synced_at,
  };
}

/** When each country was last extracted, from the most recent runs */
async function lastExtractionByCountry(): Promise<Map<string, string>> {
  const { data } = await result(admin().from('runs').select('params, started_at').order('started_at', { ascending: false }).limit(500), 'last runs');
  const out = new Map<string, string>();
  for (const row of data as { params: any; started_at: string }[]) {
    for (const plan of row.params?.plans ?? []) if (plan.countryCode && !out.has(plan.countryCode)) out.set(plan.countryCode, row.started_at);
  }
  return out;
}

async function getRow(code: string): Promise<ConfigRow | null> {
  const { data } = await result(admin().from('country_config').select('*').eq('code', code).maybeSingle(), 'get country');
  return (data as ConfigRow | null) ?? null;
}

// ---------------------------------------------------------------- validation

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const countryPatchSchema = z.object({
  name: optionalText(80),
  sourceName: optionalText(120),
  sourceUrl: z.union([z.url('Enter a full link, e.g. https://example.gov/data'), z.literal('')]).optional(),
  endpoint: optionalText(300),
  method: optionalText(500),
  output: optionalText(500),
  notes: optionalText(2000),
  lagMonths: z.number().int().min(0).max(24).optional(),
  publishDay: z.number().int().min(1).max(31).optional(),
  startPeriod: z.union([z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM'), z.literal('')]).optional(),
});

export const newCountrySchema = countryPatchSchema.extend({
  code: z.string().trim().regex(/^[A-Za-z]{3}$/, 'Use the 3-letter ISO code, e.g. VNM'),
  name: z.string().trim().min(2, 'Enter the country name').max(80),
  sourceUrl: z.url('Enter a full link, e.g. https://example.gov/data'),
});

export const monthChangesSchema = z.object({
  changes: z
    .array(
      z.object({
        period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM'),
        status: z.enum(['completed', 'extracting']).nullable(),
      })
    )
    .min(1, 'Nothing to save')
    .max(1200),
});

// ---------------------------------------------------------------- service

/** Countries, their month status and admins' edits, in Supabase Postgres */
export const countries = {
  async list(): Promise<Country[]> {
    const db = admin();
    const [rows, months, lastRuns] = await Promise.all([
      result(db.from('country_config').select('*'), 'list countries'),
      result(db.from('month_status').select('country_code, period, status, marked_at').order('period'), 'list months'),
      lastExtractionByCountry(),
    ]);
    const byCountry = new Map<string, MonthRow[]>();
    for (const m of months.data as MonthRow[]) byCountry.set(m.country_code, [...(byCountry.get(m.country_code) ?? []), m]);
    return (rows.data as ConfigRow[])
      .map((row) => build(row, byCountry.get(row.code) ?? [], lastRuns.get(row.code)))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(code: string): Promise<Country> {
    const country = (await this.list()).find((c) => c.code === code.toUpperCase());
    if (!country) throw notFound(`Unknown country ${code.toUpperCase()}`);
    return country;
  },

  /**
   * Applies month changes: a status sets it, null clears it (files are kept).
   * Returns how many months actually changed.
   */
  async setMonths(code: string, changes: MonthChange[], by: string): Promise<number> {
    const country = await this.get(code);
    const latest = new Map(changes.map((c) => [c.period, c.status]));
    const current = (p: string) => (country.completedMonths.includes(p) ? 'completed' : country.extractingMonths.includes(p) ? 'extracting' : null);
    const effective = [...latest].filter(([period, status]) => current(period) !== status);
    const toSet = effective.filter(([, s]) => s !== null);
    const toClear = effective.filter(([, s]) => s === null).map(([p]) => p);

    const db = admin();
    const markedAt = new Date().toISOString();
    if (toSet.length) {
      const rows = toSet.map(([period, status]) => ({ country_code: country.code, period, status, marked_by: by, marked_at: markedAt }));
      await result(db.from('month_status').upsert(rows), 'mark months');
    }
    if (toClear.length) await result(db.from('month_status').delete().eq('country_code', country.code).in('period', toClear), 'clear months');
    return effective.length;
  },

  /** Admin: edits a country's details (an extracted country's are stored as overrides) */
  async update(code: string, patch: CountryPatch, by: string): Promise<Country> {
    const row = await getRow(code.toUpperCase());
    if (!row) throw notFound(`Unknown country ${code.toUpperCase()}`);
    const data = { ...(row.data ?? {}), ...patch };
    await result(admin().from('country_config').update({ data, updated_at: new Date().toISOString(), updated_by: by }).eq('code', row.code), 'save country');
    return this.get(row.code);
  },

  /** Admin: adds a download-only country */
  async createManual(input: CountryPatch & { code: string }, by: string): Promise<Country> {
    const { code: rawCode, ...data } = input;
    const code = rawCode.toUpperCase();
    if (await getRow(code)) throw conflict(`${code} already exists`);
    await result(admin().from('country_config').insert({ code, kind: 'manual', data, updated_by: by }), 'add country');
    return this.get(code);
  },

  /** Admin: removes a download-only country and its month status (uploaded files stay until deleted from Files) */
  async removeManual(code: string): Promise<void> {
    const row = await getRow(code.toUpperCase());
    if (!row) throw notFound(`Unknown country ${code.toUpperCase()}`);
    if (row.kind !== 'manual') throw badRequest(`${row.code} is extracted by the extraction service and cannot be deleted`);
    await result(admin().from('month_status').delete().eq('country_code', row.code), 'delete months');
    await result(admin().from('country_config').delete().eq('code', row.code), 'delete country');
  },
};
