'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, setUnauthorizedHandler } from './api';
import { supabase } from './supabase';
import type { Country, ExportFile, Health, Me, Run } from './types';

type AuthState = 'checking' | 'in' | 'out';

interface AppState {
  auth: AuthState;
  me: Me | null;
  isAdmin: boolean;
  /** Why the last sign-in didn't get through (e.g. IP not allowed), shown on the sign-in screen */
  authError: string;
  signOut: () => void;

  health: Health | null;
  countries: Country[] | null;
  runs: Run[] | null;
  files: ExportFile[] | null;

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

const POLL_MS = 3000;

/**
 * Global state for every page: the Supabase session, the user's role, and server data.
 * Data loads once after sign-in and polls while an extraction is running, so switching
 * pages never refetches or loses state.
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>('checking');
  const [me, setMe] = useState<Me | null>(null);
  const [authError, setAuthError] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [files, setFiles] = useState<ExportFile[] | null>(null);
  const [refreshing, setRefreshing] = useState({ runs: false, files: false });

  const reset = useCallback(() => {
    setMe(null);
    setHealth(null);
    setCountries(null);
    setRuns(null);
    setFiles(null);
    setAuth('out');
  }, []);

  const signOut = useCallback(() => {
    supabase.auth.signOut().finally(reset);
  }, [reset]);

  // A Supabase session alone isn't enough: the API must accept it (IP allow-list, deleted accounts)
  const loadMe = useCallback(async () => {
    try {
      setMe(await api.me());
      setAuthError('');
      setAuth('in');
    } catch (err) {
      setAuthError(err instanceof ApiError ? err.message : 'The API server is not responding. Is it running?');
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

  // Errors are handled by the 401 handler, or simply show again on the next refresh
  const refreshCountries = useCallback(() => api.countries().then(setCountries).catch(() => {}), []);
  const withSpinner = useCallback((key: 'runs' | 'files', task: () => Promise<unknown>) => {
    setRefreshing((r) => ({ ...r, [key]: true }));
    task().finally(() => setRefreshing((r) => ({ ...r, [key]: false })));
  }, []);
  const refreshRuns = useCallback(() => withSpinner('runs', () => api.runs(50).then(setRuns).catch(() => {})), [withSpinner]);
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
    if (auth !== 'in') return;
    api.health().then(setHealth).catch(() => {});
    refreshActivity();
  }, [auth, refreshActivity]);

  // Poll quietly while something is running; refresh everything once it stops
  const running = !!runs?.some((r) => r.status === 'RUNNING');
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) refreshActivity();
    wasRunning.current = running;
    if (auth !== 'in' || !running) return;
    const timer = setInterval(() => api.runs(50).then(setRuns).catch(() => {}), POLL_MS);
    return () => clearInterval(timer);
  }, [auth, running, refreshActivity]);

  const value = useMemo<AppState>(
    () => ({
      auth,
      me,
      isAdmin: me?.role === 'admin',
      authError,
      signOut,
      health,
      countries,
      runs,
      files,
      refreshing,
      refreshRuns,
      refreshFiles,
      refreshCountries,
      putCountry,
      refreshActivity,
    }),
    [auth, me, authError, signOut, health, countries, runs, files, refreshing, refreshRuns, refreshFiles, refreshCountries, putCountry, refreshActivity]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
