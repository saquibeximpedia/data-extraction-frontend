// Shapes returned by the Express API (see ../src/types and controllers in the backend)

export type TradeFlow = 'IMPORT' | 'EXPORT';
export type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED' | 'STOPPED';
export type RunTrigger = 'SCHEDULED' | 'AUTO_SYNC_API' | 'MANUAL_EXTRACT';

export interface RunLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface Country {
  code: string;
  name: string;
  enabled: boolean;
  missingConfig: string[];
  lagMonths: number;
  updateDayOfMonth: number;
  supportedTradeTypes: TradeFlow[];
  rateLimitPerMinute: number;
  autoSyncPeriods: string[]; // "YYYY-MM", oldest first
  hsCodeCount: number; // size of the server-side saved list (codes are never sent)
  invalidHsCodeCount: number;
  testHsCodeCount?: number;
  hasTestCodes?: boolean;
}

export interface Health {
  status?: string;
  environment?: string;
  isProd?: boolean;
  scheduler: { enabled: boolean; cron: string; autoSyncRunning: boolean; lookbackMonths: number };
  summary: {
    totalTasks: number;
    byStatus: { IN_PROGRESS: number; COMPLETED: number; NO_DATA: number; FAILED: number };
    countriesCount: number;
    latestRun?: { id: string; status: RunStatus; startedAt: string };
  };
}

export interface RunStats {
  planned?: number; // missing on runs recorded before progress tracking
  completed: number;
  noData: number;
  failed: number;
  skipped: number;
  unpublishedPeriods: Record<string, string[]>;
  invalidHsCodes: Record<string, string[]>;
  files: string[];
}

export interface Run {
  id: string;
  trigger: RunTrigger;
  status: RunStatus;
  params?: Record<string, any>;
  stats: RunStats;
  logs?: RunLog[];
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface ExportFile {
  fileName: string;
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
}

/** Response of POST /api/extractions and /api/extractions/daily-check: runs start in the background */
export interface RunResponse {
  status: 'ACCEPTED';
  runId: string;
}
