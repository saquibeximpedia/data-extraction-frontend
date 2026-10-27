import 'server-only';
import { result } from '@/lib/http';
import { admin } from '@/lib/supabase/server';
import type { Run } from '@/lib/types';

const emptyStats = () => ({ planned: 0, completed: 0, noData: 0, failed: 0, skipped: 0, flags: [], invalidHsCodes: {}, files: [] });

const toRun = (row: any): Run => ({
  id: row.id,
  trigger: row.trigger,
  status: row.status,
  params: row.params,
  stats: { ...emptyStats(), ...row.stats },
  error: row.error ?? undefined,
  startedAt: row.started_at,
  finishedAt: row.finished_at ?? undefined,
});

const table = () => admin().from('runs').select('*').order('started_at', { ascending: false });

/**
 * Extraction history, as the extraction service records it. Stats of a running extraction are
 * saved every few seconds; the live numbers come from the service itself.
 */
export const runs = {
  /** The latest extractions, newest first (only a country's, when given) */
  async list(limit = 50, country?: string): Promise<Run[]> {
    let query = table().limit(limit);
    if (country) query = query.contains('params', { plans: [{ countryCode: country.toUpperCase() }] });
    return (await result(query, 'list runs')).data.map(toRun);
  },

  /** Extractions the database says are running (the live service may know better) */
  async running(): Promise<Run[]> {
    return (await result(table().eq('status', 'RUNNING').limit(50), 'running runs')).data.map(toRun);
  },

  async get(id: string): Promise<Run | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data } = await result(admin().from('runs').select('*').eq('id', id).maybeSingle(), 'get run');
    return data ? toRun(data) : null;
  },
};
