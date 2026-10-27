// Shapes returned by this app's own /api routes (data: countries, months, runs history, files,
// users) and by the extraction service (health, extractors, live runs, logs).

export type TradeFlow = 'IMPORT' | 'EXPORT';
export type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED' | 'STOPPED';
export type RunTrigger = 'MANUAL_EXTRACT';
export type Role = 'admin' | 'user';
/** 'extracting' once an extraction starts for the month; users mark it 'completed' */
export type MonthStatus = 'extracting' | 'completed';

export interface Me {
  id: string;
  username: string;
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
  /** Download-only countries: a direct link to a month's file ({YYYY} {YY} {MM} {M} placeholders); '' when none */
  fileUrl: string;
}

/** What the extraction service can do for one country (GET {service}/api/countries) */
export interface ExtractorInfo {
  code: string;
  name: string;
  enabled: boolean;
  missingConfig: string[];
  source: CountrySource;
  lagMonths: number;
  publishDay: number;
  /** Earliest month with data (older services don't say) */
  startPeriod?: string | null;
  tradeTypes: TradeFlow[];
  hsCodeHint: string;
  hsCodeCount: number;
  testHsCodeCount: number;
  /** The source's own limits (older services don't say; null: the service setting applies) */
  concurrency?: number | null;
  rateLimitPerMinute?: number;
}

/**
 * GET /api/countries.
 * kind 'api': the extraction service extracts it; 'manual': download-only (files are uploaded)
 */
export interface Country {
  code: string;
  name: string;
  kind: 'api' | 'manual';
  /** As last published by the extraction service; the live service may say otherwise */
  enabled: boolean;
  missingConfig: string[];
  source: CountrySource;
  notes: string;
  lagMonths: number;
  defaultLagMonths: number;
  publishDay: number;
  /** Earliest month the source has data for ("YYYY-MM"); null when there is no limit */
  startPeriod: string | null;
  /** The extractor's own start month, used when admins leave it empty */
  defaultStartPeriod: string | null;
  tradeTypes: TradeFlow[];
  hsCodeHint: string;
  hsCodeCount: number; // size of the service's saved list (codes are never sent)
  testHsCodeCount: number;
  recentPeriods: string[]; // "YYYY-MM", oldest first: the latest months the source should have out (none before startPeriod)
  completedMonths: string[]; // marked completed by users, oldest first
  extractingMonths: string[]; // an extraction was started; not marked completed yet
  latestCompleted: string | null;
  lastExtractedAt: string | null;
  lastUpdatedAt: string | null; // latest month change or extraction
  updatedAt: string | null;
  updatedBy: string | null;
  /** When the extraction service last published its details for this country */
  extractorSyncedAt: string | null;
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
  /** "YYYY-MM"; empty uses the extractor's default */
  startPeriod?: string;
  /** Download-only: a direct link to the month's Excel/CSV, with {YYYY} {YY} {MM} {M} for the month */
  fileUrl?: string;
}

/** One month's new status; null clears it (back to not done) */
export interface MonthChange {
  period: string;
  status: MonthStatus | null;
}

export interface AdminUser {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
  lastSignInAt: string | null;
}

/** GET {service}/api/health */
export interface ServiceHealth {
  status: string;
  service?: string;
  environment?: string;
  isProd?: boolean;
  startedAt?: string;
  running?: number;
  countries?: string[];
  /** Whether its database tables are set up and its countries published (older services don't say) */
  database?: { ok: boolean; error?: string };
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
  /** A month too big for one upload is stored in parts (_part1, _part2…); null for a whole month */
  part: number | null;
  /** Who uploaded it (null for extracted files) */
  uploadedBy: string | null;
}

/** A file in a share link, as it was when the link was made */
export interface SharedFile {
  path: string;
  /** What people see (an uploaded file's original name) */
  name: string;
  size: number;
}

/** A share link: anyone with /s/{id} can download its files (after its password, if it has one) */
export interface Share {
  id: string;
  title: string | null;
  files: SharedFile[];
  hasPassword: boolean;
  /** null: never expires */
  expiresAt: string | null;
  expired: boolean;
  downloadCount: number;
  lastDownloadAt: string | null;
  createdBy: string;
  createdAt: string;
}

/** What the public link page gets; `files` stays empty while the link is locked */
export interface PublicShare {
  title: string | null;
  expiresAt: string | null;
  hasPassword: boolean;
  locked: boolean;
  files: SharedFile[];
}

/** Response of POST {service}/api/extractions: runs start in the background */
export interface RunResponse {
  status: 'ACCEPTED';
  runId: string;
}

/** Extraction settings on the service (GET / PUT /api/settings); admins change them on the Settings page */
export interface AppSettings {
  maxConcurrentExtractions: number;
  maxConcurrentPerCountry: number;
  retryMaxAttempts: number;
  retryDelayMs: number;
  emptyStreakFlagAt: number;
  maxUploadMb: number;
}

/** Per-run tuning on the extract form; anything left out uses the settings or the country's own limits */
export interface RunOptions {
  concurrency?: number;
  rateLimitPerMinute?: number;
  retryMaxAttempts?: number;
  retryDelayMs?: number;
}
