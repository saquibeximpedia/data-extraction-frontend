import { Skeleton } from './ui';

/**
 * Placeholders shaped like each page, shown while a page loads (route loading.tsx)
 * so switching tabs never shows a blank screen or a spinner.
 */

function HeadSkeleton({ titleWidth = 180 }: { titleWidth?: number }) {
  return (
    <div className="page-head">
      <Skeleton width={titleWidth} height={26} radius={6} />
      <Skeleton width={340} height={13} />
    </div>
  );
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <section className="panel panel-flush">
      <div className="panel-head padded">
        <Skeleton width={120} height={16} />
        <Skeleton width={200} height={30} radius={8} />
      </div>
      <div className="padded skeleton-rows">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} height={36} radius={6} />
        ))}
      </div>
    </section>
  );
}

function StatsSkeleton() {
  return (
    <section className="stat-row">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="stat-tile">
          <Skeleton width={90} height={12} />
          <Skeleton width={60} height={24} radius={6} />
          <Skeleton width={130} height={11} />
        </div>
      ))}
    </section>
  );
}

export function OverviewSkeleton() {
  return (
    <>
      <HeadSkeleton titleWidth={160} />
      <StatsSkeleton />
      <TableSkeleton rows={5} />
    </>
  );
}

export function FormSkeleton() {
  return (
    <>
      <HeadSkeleton titleWidth={110} />
      <div className="extract-layout">
        <section className="panel skeleton-rows">
          <Skeleton height={36} radius={8} />
          <Skeleton height={30} radius={6} />
          <Skeleton height={36} radius={8} />
          <Skeleton height={36} radius={8} />
          <div className="skeleton-foot">
            <Skeleton width={160} height={12} />
            <Skeleton width={140} height={34} radius={8} />
          </div>
        </section>
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
