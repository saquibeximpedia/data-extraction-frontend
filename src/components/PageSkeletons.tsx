import { Skeleton } from './ui';

/**
 * Placeholders shaped like each page, shown while a page loads (route loading.tsx)
 * so switching tabs never shows a blank screen or a spinner.
 */

function HeadSkeleton({ titleWidth = 180 }: { titleWidth?: number }) {
  return (
    <div className="page-head">
      <Skeleton width={titleWidth} height={36} radius={10} />
      <Skeleton width={340} height={14} />
    </div>
  );
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <section className="panel glass panel-flush">
      <div className="panel-head padded">
        <Skeleton width={120} height={14} />
        <Skeleton width={90} height={32} radius={999} />
      </div>
      <div className="padded skeleton-rows">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} height={40} radius={12} />
        ))}
      </div>
    </section>
  );
}

export function OverviewSkeleton() {
  return (
    <>
      <HeadSkeleton titleWidth={200} />
      <section className="stats glass">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat">
            <Skeleton width={110} height={13} />
            <Skeleton width={60} height={34} radius={8} />
            <Skeleton width={150} height={11} />
          </div>
        ))}
      </section>
      <div className="overview-grid">
        <section className="panel glass skeleton-rows">
          <Skeleton width={160} height={20} radius={8} />
          <div className="extract-grid">
            <Skeleton height={42} radius={999} />
            <Skeleton height={42} radius={999} />
          </div>
          <Skeleton height={42} radius={999} />
          <Skeleton height={42} radius={16} />
          <div className="skeleton-foot">
            <Skeleton width={140} height={12} />
            <Skeleton width={150} height={40} radius={999} />
          </div>
        </section>
        <TableSkeleton rows={3} />
      </div>
    </>
  );
}

export function ListPageSkeleton({ titleWidth }: { titleWidth: number }) {
  return (
    <>
      <HeadSkeleton titleWidth={titleWidth} />
      <TableSkeleton rows={5} />
    </>
  );
}
