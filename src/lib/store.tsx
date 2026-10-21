'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';
import { SUPPORTED_COUNTRIES } from './countries';
import type { Country, ExportFile, Health, Run } from './types';

type AuthState = 'checking' | 'in' | 'out' | 'expired';

interface AppState {
  auth: AuthState;
  login: (token: string) => void;
  logout: () => void;

  health: Health | null;
  countries: Country[];
  runs: Run[] | null;
  files: ExportFile[] | null;

  /** The country the Overview works with; remembered per browser */
  selected?: string;
  setSelected: (code: string) => void;

  refreshing: { runs: boolean; files: boolean };
  refreshRuns: () => void;
  refreshFiles: () => void;
  /** Health + runs + files: call after starting a run */
  refreshActivity: () => void;
}

const AppContext = createContext<AppState | null>(null);

const POLL_MS = 3000;
const COUNTRY_KEY = 'tx_country';

function readCountry(): string | undefined {
  try {
    return localStorage.getItem(COUNTRY_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Global state for every page: the session, server data, and the selected country.
 * Data loads once after login and polls while a run is in progress, so switching
 * pages never refetches or loses state.
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>('checking');
  const [health, setHealth] = useState<Health | null>(null);
  const countries = SUPPORTED_COUNTRIES;
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [files, setFiles] = useState<ExportFile[] | null>(null);
  const [selected, setSelectedState] = useState<string>(() => readCountry() || SUPPORTED_COUNTRIES[0].code);
  const [refreshing, setRefreshing] = useState({ runs: false, files: false });

  // Resume this tab's session if its token is still valid
  useEffect(() => {
    setUnauthorizedHandler(() => setAuth('expired'));
    if (!getToken()) {
      setAuth('out');
      return;
    }
    api
      .checkToken()
      .then(() => setAuth('in'))
      .catch(() => {
        setToken('');
        setAuth('out');
      });
  }, []);

  const setSelected = useCallback((code: string) => {
    setSelectedState(code);
    try {
      localStorage.setItem(COUNTRY_KEY, code);
    } catch {
      // storage blocked: selection just won't be remembered
    }
  }, []);

  // Errors are handled by the 401 handler, or simply show again on the next refresh
  const refreshHealth = useCallback(() => api.health().then(setHealth).catch(() => {}), []);
  const withSpinner = useCallback((key: 'runs' | 'files', task: () => Promise<unknown>) => {
    setRefreshing((r) => ({ ...r, [key]: true }));
    task().finally(() => setRefreshing((r) => ({ ...r, [key]: false })));
  }, []);
  const refreshRuns = useCallback(() => withSpinner('runs', () => api.runs(50).then(setRuns).catch(() => {})), [withSpinner]);
  const refreshFiles = useCallback(() => withSpinner('files', () => api.files().then(setFiles).catch(() => {})), [withSpinner]);
  const refreshActivity = useCallback(() => {
    refreshHealth();
    refreshRuns();
    refreshFiles();
  }, [refreshHealth, refreshRuns, refreshFiles]);

  useEffect(() => {
    if (auth !== 'in') return;
    refreshActivity();
  }, [auth, refreshActivity]);

  // Poll quietly while something is running
  const running = !!runs?.some((r) => r.status === 'RUNNING') || !!health?.scheduler.autoSyncRunning;
  useEffect(() => {
    if (auth !== 'in' || !running) return;
    const timer = setInterval(() => {
      refreshHealth();
      api.runs(50).then(setRuns).catch(() => {});
      api.files().then(setFiles).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [auth, running, refreshHealth]);

  const login = useCallback((token: string) => {
    setToken(token);
    setAuth('in');
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setAuth('out');
    setHealth(null);
    setRuns(null);
    setFiles(null);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      auth,
      login,
      logout,
      health,
      countries,
      runs,
      files,
      selected,
      setSelected,
      refreshing,
      refreshRuns,
      refreshFiles,
      refreshActivity,
    }),
    [auth, login, logout, health, countries, runs, files, selected, setSelected, refreshing, refreshRuns, refreshFiles, refreshActivity]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
