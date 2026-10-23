'use client';

import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { fmtDate, fmtMonth, fmtRelative, plural } from '@/lib/format';
import { ExtractLink } from './MonthGrid';
import { Badge, CodeAvatar, Icon, Skeleton } from './ui';

/** Every country with its latest completed month and when it last changed; a row opens the country */
export function DashboardView() {
  const { countries } = useApp();
  const router = useRouter();

  return (
    <section className="panel glass panel-flush reveal" style={{ '--i': 1 } as React.CSSProperties}>
      {countries === null ? (
        <div className="padded skeleton-rows">
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
      ) : countries.length === 0 ? (
        <p className="empty">No countries yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Country</th>
                <th style={{ width: 200 }}>Latest completed</th>
                <th style={{ width: 160 }}>Last updated</th>
                <th style={{ width: 150 }} />
              </tr>
            </thead>
            <tbody>
              {countries.map((c) => (
                <tr key={c.code} className="clickable" onClick={() => router.push(`/countries/${c.code}`)}>
                  <td>
                    <div className="country-cell">
                      <CodeAvatar code={c.code} muted={!c.enabled} />
                      <span className="cell-strong">{c.name}</span>
                      {c.kind === 'manual' && <Badge tone="blue">Download-only</Badge>}
                      {c.extractingMonths.length > 0 && <Badge tone="amber">{plural(c.extractingMonths.length, 'month')} extracting</Badge>}
                    </div>
                  </td>
                  <td>
                    {c.latestCompleted ? (
                      <>
                        <div className="cell-strong">{fmtMonth(c.latestCompleted)}</div>
                        <div className="cell-sub">{plural(c.completedMonths.length, 'month')} completed</div>
                      </>
                    ) : (
                      <span className="faint">None yet</span>
                    )}
                  </td>
                  <td className="cell-sub-color nowrap" title={fmtDate(c.lastUpdatedAt ?? undefined)}>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
