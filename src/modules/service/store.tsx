'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui';
import { capitalize } from '@/lib/format';
import { describeRun, mergeRuns } from '@/lib/runs';
import type { ExtractorInfo, Me, Run, ServiceHealth } from '@/lib/types';
import { getRun } from '@/modules/extractions/actions';
import { checkService, extractor, saveServiceUrl, serviceUrl } from './client';

/** Whether the extraction service answers at the configured URL */
export interface ServiceState {
  url: string;
  status: 'checking' | 'live' | 'offline';
  health: ServiceHealth | null;
  /** Why it is offline */
  error: string;
  checkedAt: number | null;
}

interface AppState {
  me: Me;
  isAdmin: boolean;
  service: ServiceState;
  serviceLive: boolean;
  /** What the live service can extract (null while offline or loading) */
  extractors: ExtractorInfo[] | null;
  /** Extractions running on the service right now (empty while it is offline) */
  liveRuns: Run[];
  checkService: () => Promise<void>;
  /** Uses this URL for the service on this browser (null goes back to the default) */
  setServiceUrl: (url: string | null) => void;
  refreshLiveRuns: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

const LIVE_POLL_MS = 3000;
const HEALTH_POLL_MS = 15000;

/**
 * What every signed-in page shares in the browser: who is signed in, and the extraction service
 * (health, extractors, live runs). Data from the database comes with each page from the server;
 * when an extraction ends this says so in a toast and refreshes that data.
 */
export function AppProvider({ me, children }: { me: Me; children: React.ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [service, setService] = useState<ServiceState>({ url: '', status: 'checking', health: null, error: '', checkedAt: null });
  const [extractors, setExtractors] = useState<ExtractorInfo[] | null>(null);
  const [liveRuns, setLiveRuns] = useState<Run[]>([]);
  // Runs seen running last time, to tell which ended; cleared without toasts when the service goes away
  const seen = useRef<Run[]>([]);
  const live = service.status === 'live';

  const checkNow = useCallback(async () => {
    const url = serviceUrl();
    setService((s) => ({ ...s, url, status: s.url === url && s.status !== 'checking' ? s.status : 'checking' }));
    const result = await checkService(url);
    // Ignore the answer if the URL changed while waiting
    if (serviceUrl() !== url) return;
    setService({ url, status: result.ok ? 'live' : 'offline', health: result.ok ? result.health : null, error: result.ok ? '' : result.error, checkedAt: Date.now() });
  }, []);

  const refreshLiveRuns = useCallback(() => extractor.liveRuns().then(setLiveRuns, () => {}), []);

  const setServiceUrl = useCallback(
    (url: string | null) => {
      saveServiceUrl(url);
      checkNow();
    },
    [checkNow]
  );

  useEffect(() => {
    checkNow();
    const timer = setInterval(checkNow, HEALTH_POLL_MS);
    return () => clearInterval(timer);
  }, [checkNow]);

  // What the service extracts and runs: loaded whenever it (re)appears, also after a restart
  // quicker than a health check (e.g. a dev reload), which can bring new countries
  const startedAt = live ? service.health?.startedAt : undefined;
  useEffect(() => {
    seen.current = [];
    setExtractors(null);
    setLiveRuns([]);
    if (!live) return;
    extractor.countries().then(setExtractors, () => setExtractors(null));
    refreshLiveRuns();
  }, [live, service.url, startedAt, refreshLiveRuns]);

  // A health check that sees runs we don't know about (e.g. started from another browser) fetches them
  const reportedRunning = live ? (service.health?.running ?? 0) : 0;
  useEffect(() => {
    if (reportedRunning > liveRuns.length) refreshLiveRuns();
  }, [reportedRunning, service.checkedAt]);

  // Poll live runs while the service runs something
  useEffect(() => {
    if (!liveRuns.length) return;
    const timer = setInterval(refreshLiveRuns, LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [liveRuns.length > 0, refreshLiveRuns]);

  // An extraction that left the live list ended: say how, and reload the pages' data
  useEffect(() => {
    const ended = seen.current.filter((r) => !liveRuns.some((l) => l.id === r.id));
    seen.current = liveRuns;
    if (!ended.length) return;
    router.refresh();
    const announce = async (id: string, retry = true) => {
      const result = await getRun(id);
      const run = result.ok ? result.data : null;
      // The service may save the end a moment after it drops the run
      if (run?.status === 'RUNNING' && retry) return void setTimeout(() => announce(id, false), 3000);
      if (!run || run.status === 'RUNNING') return;
      const ok = run.status === 'COMPLETED';
      toast(ok ? 'ok' : 'err', ok ? 'Extraction finished: check the files' : `Extraction ${capitalize(run.status).toLowerCase()}`, describeRun(run), {
        label: ok ? 'Review' : 'Open',
        onClick: () => router.push(`/extractions/${run.id}`),
      });
      if (!retry) router.refresh();
    };
    for (const run of ended) announce(run.id);
  }, [liveRuns, router, toast]);

  // The service publishes its countries once its database is set up: reload them when that happens
  const databaseOk = live ? service.health?.database?.ok : undefined;
  const databaseWasOk = useRef(databaseOk);
  useEffect(() => {
    if (databaseOk && databaseWasOk.current === false) router.refresh();
    if (databaseOk !== undefined) databaseWasOk.current = databaseOk;
  }, [databaseOk, router]);

  const value = useMemo<AppState>(
    () => ({
      me,
      isAdmin: me.role === 'admin',
      service,
      serviceLive: live,
      extractors,
      liveRuns: live ? liveRuns : [],
      checkService: checkNow,
      setServiceUrl,
      refreshLiveRuns,
    }),
    [me, service, live, extractors, liveRuns, checkNow, setServiceUrl, refreshLiveRuns]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** Runs from the database with the live service's fresher copies on top */
export function useRuns(history: Run[]): Run[] {
  const { liveRuns } = useApp();
  return useMemo(() => mergeRuns(history, liveRuns), [history, liveRuns]);
}

/**
 * Whether the live extraction service can extract a country right now.
 * reason: 'offline' when the service is down (callers usually just hide the action), otherwise
 * a sentence saying why not.
 */
export function useExtractability() {
  const { serviceLive, extractors } = useApp();
  return useCallback(
    (code: string): { ok: boolean; reason: string } => {
      if (!serviceLive) return { ok: false, reason: 'offline' };
      if (!extractors) return { ok: false, reason: 'Loading what the extraction service supports…' };
      const info = extractors.find((e) => e.code === code);
      if (!info) return { ok: false, reason: `The extraction service has no extractor for ${code}.` };
      if (!info.enabled) return { ok: false, reason: `Disabled on the extraction service: set ${info.missingConfig.join(', ')} in its .env.` };
      return { ok: true, reason: '' };
    },
    [serviceLive, extractors]
  );
}
