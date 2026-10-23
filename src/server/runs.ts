import type { Run } from '@/lib/types';
import { result } from './http';
import { admin } from './supabase';

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

/**
 * Extraction history, as the extraction service records it. Stats of a running extraction are
 * saved every few seconds; the live numbers come from the service itself.
 */
export const runs = {
  async list(limit: number, country?: string): Promise<Run[]> {
    let query = admin().from('runs').select('*').order('started_at', { ascending: false }).limit(limit);
    if (country) query = query.contains('params', { plans: [{ countryCode: country.toUpperCase() }] });
    return (await result(query, 'list runs')).data.map(toRun);
  },

  async get(id: string): Promise<Run | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data } = await result(admin().from('runs').select('*').eq('id', id).maybeSingle(), 'get run');
    return data ? toRun(data) : null;
  },
};
