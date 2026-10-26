'use client';

import Link from 'next/link';
import type { Country } from '@/lib/types';
import { fmtMonth, fmtRange, plural } from '@/lib/format';
import { useExtractability, useSetMonths } from '@/lib/hooks';
import type { CountryStatus } from '@/lib/status';
import { Button, Icon, type Tone } from './ui';

/** The extract form for a country, with its months filled in when given */
export function extractHref(code: string, periods: string[] = []): string {
  if (!periods.length) return `/extract?country=${code}`;
  const sorted = [...periods].sort();
  return `/extract?country=${code}&start=${sorted[0]}&end=${sorted[sorted.length - 1]}`;
}

/** "Jul 2026" for one month, "3 months" for more */
const monthsWord = (periods: string[]) => (periods.length === 1 ? fmtMonth(periods[0]) : plural(periods.length, 'month'));

/** One line saying what a country needs next, and how urgent it is */
export function describeStep(country: Country, status: CountryStatus): { text: string; tone: Tone } {
  const { next } = status;
  switch (next.kind) {
    case 'review':
      return { text: `${fmtRange(next.periods)} extracted: check the files, then mark ${next.periods.length === 1 ? 'it' : 'them'} completed`, tone: 'amber' };
    case 'running':
      return { text: `Extracting ${fmtRange(next.periods)} now`, tone: 'blue' };
    case 'due': {
      const verb = country.kind === 'manual' ? 'to upload' : 'to extract';
      if (status.behind === null) return { text: `Nothing completed yet · ${fmtMonth(next.periods[next.periods.length - 1])} is out`, tone: 'neutral' };
      return { text: `${fmtRange(next.periods)} ${verb} (${plural(next.periods.length, 'month')} behind)`, tone: 'neutral' };
    }
    case 'done':
      return { text: 'Up to date with the source', tone: 'green' };
  }
}

/** Marks months completed in one click (with Undo in the toast) */
export function MarkCompletedButton({ country, periods, size = 'sm', label }: { country: Country; periods: string[]; size?: 'sm' | 'md'; label?: string }) {
  const { busy, setMonths } = useSetMonths();
  return (
    <Button
      size={size}
      variant="primary"
      icon={<Icon.Check size={14} />}
      loading={busy}
      onClick={(e) => {
        e.stopPropagation();
        setMonths(country, periods, 'completed');
      }}
    >
      {label ?? `Mark ${monthsWord(periods)} completed`}
    </Button>
  );
}

/**
 * The button for a country's next step: mark extracted months completed, follow the running
 * extraction, extract or upload what is due, or nothing when it is up to date.
 */
export function NextAction({ country, status, size = 'sm' }: { country: Country; status: CountryStatus; size?: 'sm' | 'md' }) {
  const extractability = useExtractability();
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const { next } = status;

  if (next.kind === 'review') return <MarkCompletedButton country={country} periods={next.periods} size={size} />;
  if (next.kind === 'running') {
    return (
      <Link href={`/extractions/${next.run.id}`} className={`btn btn-secondary btn-${size}`} onClick={stop}>
        <span className="dot dot-blue dot-live" /> View progress
      </Link>
    );
  }
  if (next.kind === 'done') {
    return (
      <span className="up-to-date">
        <Icon.Check size={13} /> Up to date
      </span>
    );
  }
  if (country.kind === 'manual') {
    return (
      <Link href={`/countries/${country.code}#upload`} className={`btn btn-secondary btn-${size}`} onClick={stop}>
        <Icon.Upload size={14} /> Upload {monthsWord(next.periods)}
      </Link>
    );
  }
  const { ok, reason } = extractability(country.code);
  if (!ok) {
    return (
      <span className="faint nowrap cell-note" title={reason === 'offline' ? 'Start the extraction service to extract' : reason}>
        {reason === 'offline' ? 'Extractor offline' : 'Not available'}
      </span>
    );
  }
  return (
    <Link href={extractHref(country.code, next.periods)} className={`btn btn-primary btn-${size}`} onClick={stop}>
      <Icon.Play size={14} /> Extract {monthsWord(next.periods)}
    </Link>
  );
}
