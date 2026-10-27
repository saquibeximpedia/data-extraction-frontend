import { Skeleton } from './ui';

/**
 * Placeholders laid out like each page (same grids, cards and columns), shown while a page loads
 * (its route's loading.tsx, or right after a tab is clicked) so the page settles in place.
 */

function PanelHeadSkeleton({ flush, title = 120, tools = 0 }: { flush?: boolean; title?: number; tools?: number }) {
  return (
    <div className={`panel-head ${flush ? 'padded' : ''}`}>
      <div className="skeleton-head">
        {title > 0 && <Skeleton width={title} height={18} />}
        {title > 0 && <Skeleton width={title + 80} height={11} />}
      </div>
      {tools > 0 && <Skeleton width={tools} height={36} radius={12} />}
    </div>
  );
}

/** Table rows, column by column, under a card head that is already drawn */
export function TableRowsSkeleton({ rows = 5, cols = [1, 0.5, 0.4, 0.3] }: { rows?: number; cols?: number[] }) {
  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="skeleton-tr" style={{ gridTemplateColumns: cols.map((c) => `${c}fr`).join(' ') }}>
          {cols.map((_, c) => (
            <Skeleton key={c} width={c === 0 ? '70%' : '55%'} height={c === 0 ? 14 : 12} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A flush card with a toolbar and table rows */
function TableSkeleton({ rows = 5, cols = [1, 0.5, 0.4, 0.3], title = 120, tools = 360 }: { rows?: number; cols?: number[]; title?: number; tools?: number }) {
  return (
    <section className="panel panel-flush">
      <PanelHeadSkeleton flush title={title} tools={tools} />
      <TableRowsSkeleton rows={rows} cols={cols} />
    </section>
  );
}

function StatsSkeleton() {
  return (
    <section className="stat-row">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="stat-tile">
          <Skeleton width={90} height={13} />
          <Skeleton width={110} height={40} radius={8} />
          <Skeleton width={130} height={11} />
        </div>
      ))}
    </section>
  );
}

function FieldsSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="skeleton-rows">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skeleton-field">
          <Skeleton width={110} height={12} />
          <Skeleton height={40} radius={12} />
        </div>
      ))}
    </div>
  );
}

/** File rows: icon, name and facts */
export function FileRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="file-list">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="file-row">
          <Skeleton width={36} height={36} radius={12} />
          <span className="file-row-text skeleton-head">
            <Skeleton width="45%" height={13} />
            <Skeleton width="30%" height={11} />
          </span>
        </div>
      ))}
    </div>
  );
}

const COUNTRY_COLS = [1.2, 0.8, 0.6, 0.6, 0.45, 0.45];

export function DashboardSkeleton() {
  return (
    <>
      <StatsSkeleton />
      <TableSkeleton rows={8} cols={COUNTRY_COLS} />
    </>
  );
}

export function CountriesSkeleton() {
  return <TableSkeleton rows={10} cols={COUNTRY_COLS} title={130} />;
}

export function CountrySkeleton() {
  return (
    <>
      <div className="page-head">
        <div className="page-head-row">
          <div className="skeleton-head">
            <Skeleton width={200} height={30} radius={8} />
            <Skeleton width={160} height={13} />
          </div>
          <Skeleton width={260} height={40} radius={999} />
        </div>
      </div>
      <StatsSkeleton />
      <section className="panel">
        <PanelHeadSkeleton title={80} tools={120} />
        <div className="year-grid">
          {[0, 1].map((y) => (
            <div key={y} className="year-row">
              <Skeleton width={56} height={14} />
              <div className="month-cells">
                {Array.from({ length: 12 }, (_, m) => (
                  <Skeleton key={m} height={32} radius={8} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="country-bottom">
        <section className="skeleton-rows">
          <Skeleton width={90} height={18} />
          <Skeleton width={180} height={13} />
          <div className="facts">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton-field">
                <Skeleton width={90} height={11} />
                <Skeleton width={140} height={13} />
              </div>
            ))}
          </div>
        </section>
        <section className="panel skeleton-rows">
          <PanelHeadSkeleton title={150} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={34} radius={10} />
          ))}
        </section>
      </div>
    </>
  );
}

export function ExtractSkeleton() {
  return (
    <div className="extract-layout">
      <div className="extract-main">
        <section className="panel">
          <div className="extract-head">
            <div className="skeleton-head">
              <Skeleton width={150} height={18} />
              <Skeleton width={260} height={11} />
            </div>
            <Skeleton height={40} radius={12} />
          </div>
          <div className="extract-form skeleton-pad-top">
            <FieldsSkeleton n={2} />
            <div className="skeleton-foot">
              <Skeleton width={200} height={12} />
              <Skeleton width={140} height={40} radius={999} />
            </div>
          </div>
        </section>
      </div>
      <aside className="extract-aside">
        <section className="panel skeleton-rows">
          <PanelHeadSkeleton title={130} />
          <div className="recent-months">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} height={40} radius={8} />
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

export function ExtractionsSkeleton() {
  return (
    <>
      <section>
        <div className="section-head">
          <Skeleton width={140} height={18} />
          <Skeleton width={140} height={32} radius={999} />
        </div>
        <Skeleton height={58} radius={20} />
      </section>
      <TableSkeleton rows={6} cols={[0.35, 1.2, 0.9, 0.35, 0.35, 0.3]} tools={240} />
    </>
  );
}

/** One extraction: the next-step banner, then its summary card with numbers, outcome and files */
export function ExtractionSkeleton() {
  return (
    <>
      <Skeleton height={76} radius={20} />
      <section className="panel">
        <PanelHeadSkeleton title={260} tools={110} />
        <div className="stat-row inset">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="stat-tile stat-inset">
              <Skeleton width={70} height={11} />
              <Skeleton width={90} height={22} radius={6} />
            </div>
          ))}
        </div>
        <Skeleton height={6} radius={999} />
        <div className="run-files">
          <PanelHeadSkeleton title={100} tools={130} />
          <FileRowsSkeleton rows={3} />
        </div>
      </section>
    </>
  );
}

export function FilesSkeleton() {
  return (
    <div className="files-layout">
      <aside className="files-side">
        <Skeleton height={40} radius={999} />
        <div className="storage">
          <Skeleton width={100} height={11} />
          <Skeleton width={140} height={22} radius={6} />
          <Skeleton height={8} radius={999} />
        </div>
        <div className="side-list">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="side-item">
              <Skeleton width={15} height={15} radius={4} />
              <Skeleton width="60%" height={12} />
            </div>
          ))}
        </div>
      </aside>
      <section className="files-main">
        <PanelHeadSkeleton title={140} tools={240} />
        <Skeleton width={90} height={32} radius={999} />
        <FileRowsSkeleton rows={7} />
      </section>
    </div>
  );
}

export function UsersSkeleton() {
  return <TableSkeleton rows={4} cols={[1, 0.4, 0.6, 0.5, 0.2]} tools={110} />;
}

/** Extraction settings (a grid of number fields) beside the account */
export function SettingsSkeleton() {
  return (
    <div className="settings-grid">
      <section className="panel">
        <PanelHeadSkeleton title={170} />
        <div className="settings-fields">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton-field">
              <Skeleton width={150} height={12} />
              <Skeleton height={40} radius={12} />
              <Skeleton width="80%" height={11} />
            </div>
          ))}
        </div>
      </section>
      <section className="panel skeleton-rows">
        <PanelHeadSkeleton title={90} />
        <Skeleton height={40} radius={12} />
      </section>
    </div>
  );
}

/** Connection form beside the service's status */
export function ServiceSkeleton() {
  return (
    <div className="settings-grid">
      <section className="panel skeleton-rows">
        <PanelHeadSkeleton title={120} />
        <FieldsSkeleton n={1} />
        <div className="chip-group">
          <Skeleton width={260} height={30} radius={999} />
          <Skeleton width={200} height={30} radius={999} />
        </div>
      </section>
      <section className="panel skeleton-rows">
        <PanelHeadSkeleton title={90} />
        <Skeleton height={40} radius={12} />
      </section>
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <section className="panel">
      <PanelHeadSkeleton title={160} />
      <FieldsSkeleton n={4} />
    </section>
  );
}

/** The skeleton for a path, e.g. the page a tab leads to */
export function skeletonFor(path: string) {
  if (path === '/') return <DashboardSkeleton />;
  if (path === '/countries') return <CountriesSkeleton />;
  if (path === '/countries/new' || path.endsWith('/edit')) return <FormPageSkeleton />;
  if (path.startsWith('/countries/')) return <CountrySkeleton />;
  if (path === '/extract') return <ExtractSkeleton />;
  if (path === '/extractions') return <ExtractionsSkeleton />;
  if (path.startsWith('/extractions/')) return <ExtractionSkeleton />;
  if (path.startsWith('/files')) return <FilesSkeleton />;
  if (path === '/users') return <UsersSkeleton />;
  if (path === '/settings') return <SettingsSkeleton />;
  if (path === '/service') return <ServiceSkeleton />;
  return <DashboardSkeleton />;
}
