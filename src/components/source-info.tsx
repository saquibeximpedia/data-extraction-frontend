'use client';

import { fmtFlows, fmtMonth, hostOf, plural, fmtNumber } from '@/lib/format';
import { latestPublished } from '@/lib/months';
import type { Country } from '@/lib/types';
import { useExtractability } from '@/modules/service/store';
import { Badge, Icon, revealStyle } from './ui';

/** Where the country's data comes from and how it is fetched: plain text on the page, no card */
export function SourceInfo({ country, i = 3, source = country.source }: { country: Country; i?: number; source?: Country['source'] }) {
  const extractability = useExtractability();
  const status = country.kind === 'manual' ? null : extractability(country.code);
  const latest = latestPublished(country);
  const facts: [string, React.ReactNode, boolean?][] = [
    ['Publication lag', `${plural(country.lagMonths, 'month')}${country.publishDay > 1 ? `, around day ${country.publishDay}` : ''}`],
    ['Latest expected', latest ? fmtMonth(latest) : '—'],
    ['Data available from', country.startPeriod && fmtMonth(country.startPeriod)],
    ['Trade flows', country.kind === 'api' && fmtFlows(country.tradeTypes)],
    [
      'Saved HS codes',
      country.kind === 'api' && (
        <>
          {fmtNumber(country.hsCodeCount)}
          {country.testHsCodeCount ? <span className="faint"> · {fmtNumber(country.testHsCodeCount)} test</span> : null}
        </>
      ),
    ],
    ['HS codes accepted', country.hsCodeHint],
    ['Requests', source.endpoint && <span className="mono">{source.endpoint}</span>, true],
    ['How it is fetched', source.method, true],
    ['What is saved', source.output, true],
    ['Notes', country.notes && <span className="pre-wrap">{country.notes}</span>, true],
  ];

  return (
    <section className="source-info reveal" style={revealStyle(i)} aria-label="Source">
      <div className="section-head">
        <h2 className="section-title">Source</h2>
        {country.kind === 'manual' ? (
          <Badge>Download-only</Badge>
        ) : status?.ok ? (
          <Badge tone="green" dot>
            Ready to extract
          </Badge>
        ) : status?.reason === 'offline' ? (
          <Badge tone="red" dot>
            Service offline
          </Badge>
        ) : (
          <Badge tone="amber" dot title={status?.reason}>
            Unavailable
          </Badge>
        )}
      </div>

      {source.url && (
        <a className="link source-link" href={source.url} target="_blank" rel="noreferrer" title={source.url}>
          {source.name || hostOf(source.url)} <Icon.External size={13} />
        </a>
      )}

      <dl className="facts">
        {facts
          .filter(([, value]) => value)
          .map(([label, value, wide]) => (
            <div key={label} className={wide ? 'wide' : ''}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}
