// Shapes returned by the Express API (see the backend's src/types and controllers)

export type TradeFlow = 'IMPORT' | 'EXPORT';
export type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED' | 'STOPPED';
export type RunTrigger = 'MANUAL_EXTRACT';
export type Role = 'admin' | 'user';
/** 'extracting' once an extraction starts for the month; users mark it 'completed' */
export type MonthStatus = 'extracting' | 'completed';

export interface Me {
  id: string;
  email: string;
  role: Role;
}

export interface RunLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface CountrySource {
  name: string;
  url: string;
  endpoint: string;
  method: string;
  output: string;
}

/**
 * GET /api/countries.
 * kind 'api': extracted by the backend; 'manual': download-only (files come from the source website)
 */
export interface Country {
  code: string;
  name: string;
  kind: 'api' | 'manual';
  enabled: boolean;
  missingConfig: string[];
  source: CountrySource;
  notes: string;
  lagMonths: number;
  defaultLagMonths: number;
  publishDay: number;
  tradeTypes: TradeFlow[];
  hsCodeHint: string;
  hsCodeCount: number; // size of the server-side saved list (codes are never sent)
  testHsCodeCount: number;
  recentPeriods: string[]; // "YYYY-MM", oldest first: the latest months the source should have out
  completedMonths: string[]; // marked completed by users, oldest first
  extractingMonths: string[]; // an extraction was started; not marked completed yet
  latestCompleted: string | null;
  lastExtractedAt: string | null;
  lastUpdatedAt: string | null; // latest month change or extraction
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Admin-editable country fields */
export interface CountryPatch {
  name?: string;
  sourceName?: string;
  sourceUrl?: string;
  endpoint?: string;
  method?: string;
  output?: string;
  notes?: string;
  lagMonths?: number;
  publishDay?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface Health {
  status?: string;
  environment?: string;
  isProd?: boolean;
}

export interface RunFlag {
  countryCode: string;
  kind: 'EMPTY_STREAK' | 'EMPTY_MONTH';
  message: string;
  at: string;
}

export interface RunStats {
  planned?: number;
  completed: number;
  noData: number;
  failed: number;
  skipped: number;
  records?: number; // rows returned by the source (older runs don't have it)
  flags?: RunFlag[];
  invalidHsCodes?: Record<string, string[]>;
  files: string[];
}

export interface RunPlan {
  countryCode: string;
  periods: string[];
  tradeTypes?: TradeFlow[];
  hsCodeSource?: 'complete' | 'test' | 'custom';
  hsCodeCount?: number;
  hsCodes?: string[];
}

export interface Run {
  id: string;
  trigger: RunTrigger;
  status: RunStatus;
  params?: { plans?: RunPlan[]; startedBy?: string };
  stats: RunStats;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface ExportFile {
  fileName: string;
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  countryCode: string | null;
  period: string | null;
  /** 'extracted' files are written by runs; 'uploaded' ones were added by users */
  origin: 'extracted' | 'uploaded';
}

/** Response of POST /api/extractions: runs start in the background */
export interface RunResponse {
  status: 'ACCEPTED';
  runId: string;
}
