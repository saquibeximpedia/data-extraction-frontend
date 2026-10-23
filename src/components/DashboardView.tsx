'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { fmtDate, fmtMonth, fmtRelative, plural } from '@/lib/format';
import { latestPublished } from '@/lib/months';
import { ExtractLink, MonthStrip } from './MonthGrid';
import { Badge, CodeAvatar, Icon, Skeleton } from './ui';

/** Shown while the extraction service is down: everything else still works */
export function ServiceOfflineNote({ what = 'Extracting' }: { what?: string }) {
  const { service } = useApp();
  if (service.status !== 'offline') return null;
  return (
    <div className="service-note reveal">
      <span className="dot dot-red" />
      <span>
        <b>The extraction service is offline</b> at <span className="mono">{service.url}</span>. {what} is unavailable until it is running; months and files still work.
      </span>
      <Link href="/settings" className="btn btn-secondary btn-sm">
        <Icon.Gear size={13} /> Settings
      </Link>
    </div>
  );
}

/** Every country with its latest completed month, the last 12 months at a glance, and its action */
export function DashboardView() {
  const { countries } = useApp();
  const router = useRouter();

  return (
    <>
      <ServiceOfflineNote />
      <section className="panel glass panel-flush reveal" style={{ '--i': 1 } as React.CSSProperties}>
        {countries === null ? (
          <div className="padded skeleton-rows">
            <Skeleton height={40} />
            <Skeleton height={40} />
          </div>
        ) : countries.length === 0 ? (
          <p className="empty">No countries yet. Start the extraction service once to publish its countries, or add a download-only country under Admin.</p>
        ) : (
          <div className="table-wrap">
            <table className="table dashboard-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th style={{ width: 190 }}>Latest completed</th>
                  <th className="col-strip" style={{ width: 210 }}>
                    Last 12 months
                  </th>
                  <th className="col-updated" style={{ width: 130 }}>
                    Last updated
                  </th>
                  <th style={{ width: 150 }} />
                </tr>
              </thead>
              <tbody>
                {countries.map((c) => {
                  const latest = latestPublished(c);
                  const upToDate = c.latestCompleted && latest && c.latestCompleted >= latest;
                  return (
                    <tr key={c.code} className="clickable" onClick={() => router.push(`/countries/${c.code}`)}>
                      <td>
                        <div className="country-cell">
                          <CodeAvatar code={c.code} muted={!c.enabled} />
                          <span>
                            <Link href={`/countries/${c.code}`} className="cell-strong row-link" onClick={(e) => e.stopPropagation()}>
                              {c.name}
                            </Link>
                            <span className="cell-sub row-meta">
                              {c.kind === 'manual' ? <Badge tone="blue">Download-only</Badge> : <span className="mono">{c.code}</span>}
                              {c.extractingMonths.length > 0 && <Badge tone="amber">{plural(c.extractingMonths.length, 'month')} extracting</Badge>}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>
                        {c.latestCompleted ? (
                          <>
                            <div className="cell-strong">
                              {fmtMonth(c.latestCompleted)} {upToDate && <span className="up-to-date" title="Nothing newer is published yet">Up to date</span>}
                            </div>
                            <div className="cell-sub">{plural(c.completedMonths.length, 'month')} completed</div>
                          </>
                        ) : (
                          <span className="faint">None yet</span>
                        )}
                      </td>
                      <td className="col-strip">
                        <MonthStrip country={c} />
                      </td>
                      <td className="cell-sub-color nowrap col-updated" title={fmtDate(c.lastUpdatedAt ?? undefined)}>
                        {c.lastUpdatedAt ? fmtRelative(c.lastUpdatedAt) : '—'}
                      </td>
                      <td className="cell-actions nowrap">
                        <div className="row-actions">
                          <ExtractLink country={c} />
                          <span className="row-chevron">
                            <Icon.ChevronRight size={15} />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
