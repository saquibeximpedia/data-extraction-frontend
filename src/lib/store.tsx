'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, checkService, extractor, saveServiceUrl, serviceUrl, setUnauthorizedHandler } from './api';
import { supabase } from './supabase';
import type { Country, ExportFile, ExtractorInfo, Me, Run, ServiceHealth } from './types';

type AuthState = 'checking' | 'in' | 'out';

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
  auth: AuthState;
  me: Me | null;
  isAdmin: boolean;
  /** Why the last sign-in didn't get through, shown on the sign-in screen */
  authError: string;
  signOut: () => void;

  countries: Country[] | null;
  files: ExportFile[] | null;
  /** History from the database, with live stats from the service for running ones */
  runs: Run[] | null;

  service: ServiceState;
  serviceLive: boolean;
  /** What the live service can extract (null while offline or loading) */
  extractors: ExtractorInfo[] | null;
  checkService: () => Promise<void>;
  /** Uses this URL for the service on this browser (null goes back to the default) */
  setServiceUrl: (url: string | null) => void;

  refreshing: { runs: boolean; files: boolean };
  refreshRuns: () => void;
  refreshFiles: () => void;
  refreshCountries: () => void;
  /** Replaces one country after an edit, without refetching the list */
  putCountry: (country: Country) => void;
  /** Runs + files + countries: call after starting a run or changing data */
  refreshActivity: () => void;
}

const AppContext = createContext<AppState | null>(null);

const LIVE_POLL_MS = 3000;
const HEALTH_POLL_MS = 15000;

/** History with each live run's fresher copy on top; runs the history hasn't seen yet come first */
function mergeRuns(history: Run[] | null, live: Run[]): Run[] | null {
  if (!history) return live.length ? live : null;
  const byId = new Map(live.map((r) => [r.id, r]));
  const fresh = live.filter((r) => !history.some((h) => h.id === r.id));
  return [...fresh, ...history.map((h) => byId.get(h.id) ?? h)];
}

/**
 * Global state for every page: the Supabase session and role, the data (from this app's API),
 * and the extraction service (health, extractors, live runs). Data loads once after sign-in; the
 * service is checked every 15 seconds and polled every 3 while it runs something.
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>('checking');
  const [me, setMe] = useState<Me | null>(null);
  const [authError, setAuthError] = useState('');
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [history, setHistory] = useState<Run[] | null>(null);
  const [liveRuns, setLiveRuns] = useState<Run[]>([]);
  const [files, setFiles] = useState<ExportFile[] | null>(null);
  const [refreshing, setRefreshing] = useState({ runs: false, files: false });
  const [service, setService] = useState<ServiceState>({ url: '', status: 'checking', health: null, error: '', checkedAt: null });
  const [extractors, setExtractors] = useState<ExtractorInfo[] | null>(null);

  const reset = useCallback(() => {
    setMe(null);
    setCountries(null);
    setHistory(null);
    setLiveRuns([]);
    setFiles(null);
    setExtractors(null);
    setAuth('out');
  }, []);

  const signOut = useCallback(() => {
    supabase.auth.signOut().finally(reset);
  }, [reset]);

  // A Supabase session alone isn't enough: this app's API must accept it (e.g. deleted accounts)
  const loadMe = useCallback(async () => {
    try {
      setMe(await api.me());
      setAuthError('');
      setAuth('in');
    } catch (err) {
      setAuthError(err instanceof ApiError ? err.message : 'The server is not responding.');
      await supabase.auth.signOut();
      reset();
    }
  }, [reset]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthError('Your session has expired. Sign in again.');
      signOut();
    });
    supabase.auth.getSession().then(({ data }) => (data.session ? loadMe() : setAuth('out')));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') loadMe();
      if (event === 'SIGNED_OUT') reset();
    });
    return () => data.subscription.unsubscribe();
  }, [loadMe, reset, signOut]);

  // ---------------------------------------------------------------- data

  // Set below once the service status is known; read by refreshRuns
  const liveRef = useRef(false);

  // Errors are handled by the 401 handler, or simply show again on the next refresh
  const refreshCountries = useCallback(() => api.countries().then(setCountries).catch(() => {}), []);
  const withSpinner = useCallback((key: 'runs' | 'files', task: () => Promise<unknown>) => {
    setRefreshing((r) => ({ ...r, [key]: true }));
    task().finally(() => setRefreshing((r) => ({ ...r, [key]: false })));
  }, []);
  const refreshRuns = useCallback(
    () =>
      withSpinner('runs', () =>
        Promise.all([
          api.runs(50).then(setHistory).catch(() => {}),
          liveRef.current ? extractor.liveRuns().then(setLiveRuns).catch(() => {}) : null,
        ])
      ),
    [withSpinner]
  );
  const refreshFiles = useCallback(() => withSpinner('files', () => api.files().then(setFiles).catch(() => {})), [withSpinner]);
  const refreshActivity = useCallback(() => {
    refreshRuns();
    refreshFiles();
    refreshCountries();
  }, [refreshRuns, refreshFiles, refreshCountries]);
  const putCountry = useCallback((country: Country) => {
    setCountries((list) => list?.map((c) => (c.code === country.code ? country : c)) ?? list);
  }, []);

  useEffect(() => {
    if (auth === 'in') refreshActivity();
  }, [auth, refreshActivity]);

  // ---------------------------------------------------------------- extraction service

  const checkNow = useCallback(async () => {
    const url = serviceUrl();
    setService((s) => ({ ...s, url, status: s.url === url && s.status !== 'checking' ? s.status : 'checking' }));
    const result = await checkService(url);
    // Ignore the answer if the URL changed while waiting
    if (serviceUrl() !== url) return;
    setService({ url, status: result.ok ? 'live' : 'offline', health: result.ok ? result.health : null, error: result.ok ? '' : result.error, checkedAt: Date.now() });
  }, []);

  const setServiceUrl = useCallback(
    (url: string | null) => {
      saveServiceUrl(url);
      setExtractors(null);
      setLiveRuns([]);
      checkNow();
    },
    [checkNow]
  );

  const live = service.status === 'live';
  liveRef.current = live;

  useEffect(() => {
    if (auth !== 'in') return;
    checkNow();
    const timer = setInterval(checkNow, HEALTH_POLL_MS);
    return () => clearInterval(timer);
  }, [auth, checkNow]);

  // What the service extracts: loaded whenever it (re)appears
  useEffect(() => {
    if (auth !== 'in' || !live) {
      setExtractors(null);
      setLiveRuns([]);
      return;
    }
    extractor.countries().then(setExtractors).catch(() => setExtractors(null));
    extractor.liveRuns().then(setLiveRuns).catch(() => {});
  }, [auth, live, service.url]);

  // A health check that sees runs we don't know about (e.g. started from another browser) fetches them
  const reportedRunning = live ? (service.health?.running ?? 0) : 0;
  useEffect(() => {
    if (auth === 'in' && reportedRunning > liveRuns.length) extractor.liveRuns().then(setLiveRuns).catch(() => {});
  }, [auth, reportedRunning, service.checkedAt]);

  // Poll live runs while the service runs something; refresh everything once one ends
  const runningCount = live ? liveRuns.length : 0;
  const wasRunning = useRef(0);
  useEffect(() => {
    if (wasRunning.current > runningCount) refreshActivity();
    wasRunning.current = runningCount;
    if (auth !== 'in' || runningCount === 0) return;
    const timer = setInterval(() => extractor.liveRuns().then(setLiveRuns).catch(() => {}), LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [auth, runningCount, refreshActivity]);

  // The service publishes its countries once its database is set up: reload them when that happens
  const databaseOk = live ? service.health?.database?.ok : undefined;
  const databaseWasOk = useRef(databaseOk);
  useEffect(() => {
    if (auth === 'in' && databaseOk && databaseWasOk.current === false) refreshCountries();
    if (databaseOk !== undefined) databaseWasOk.current = databaseOk;
  }, [auth, databaseOk, refreshCountries]);

  const runs = useMemo(() => mergeRuns(history, liveRuns), [history, liveRuns]);

  const value = useMemo<AppState>(
    () => ({
      auth,
      me,
      isAdmin: me?.role === 'admin',
      authError,
      signOut,
      countries,
      files,
      runs,
      service,
      serviceLive: live,
      extractors,
      checkService: checkNow,
      setServiceUrl,
      refreshing,
      refreshRuns,
      refreshFiles,
      refreshCountries,
      putCountry,
      refreshActivity,
    }),
    [auth, me, authError, signOut, countries, files, runs, service, live, extractors, checkNow, setServiceUrl, refreshing, refreshRuns, refreshFiles, refreshCountries, putCountry, refreshActivity]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
