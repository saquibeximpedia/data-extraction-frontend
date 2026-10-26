'use client';

import Link from 'next/link';
import type { Country } from '@/lib/types';
import { fmtMonth, fmtRange, plural } from '@/lib/format';
import { useExtractability, useSetMonths } from '@/lib/hooks';
import type { CountryStatus } from '@/lib/status';
import { Badge, Button, Icon, StatusDot, type Tone } from './ui';

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

/** The same, short enough for a table cell */
function shortStep(status: CountryStatus): { text: string; tone: Tone } {
  const { next } = status;
  switch (next.kind) {
    case 'review':
      return { text: `${monthsWord(next.periods)} to check`, tone: 'amber' };
    case 'running':
      return { text: `Extracting ${monthsWord(next.periods)}`, tone: 'blue' };
    case 'due':
      return { text: status.behind === null ? 'Nothing completed yet' : `${monthsWord(next.periods)} due`, tone: 'neutral' };
    case 'done':
      return { text: 'Up to date', tone: 'green' };
  }
}

/** A country's status as a badge */
export function StepLabel({ status }: { status: CountryStatus }) {
  const step = shortStep(status);
  return (
    <Badge tone={step.tone} dot live={status.next.kind === 'running'}>
      {step.text}
    </Badge>
  );
}

/** A country's extraction from its row: the running one, or the extract form with its due months filled in */
export function CountryLinks({ country, status }: { country: Country; status: CountryStatus }) {
  const extractability = useExtractability();
  const { next } = status;
  const canExtract = country.kind === 'api' && extractability(country.code).ok;

  return (
    <div className="row-actions">
      {next.kind === 'running' ? (
        <Link href={`/extractions/${next.run.id}`} className="btn btn-ghost btn-sm">
          Progress <Icon.ArrowRight size={13} />
        </Link>
      ) : country.kind === 'api' ? (
        <Link
          href={extractHref(country.code, next.kind === 'due' ? next.periods : [])}
          className={`btn btn-ghost btn-sm ${canExtract ? '' : 'is-disabled'}`}
          aria-disabled={!canExtract}
          title={canExtract ? undefined : 'The extraction service is offline or cannot extract this country'}
        >
          Extract <Icon.ArrowRight size={13} />
        </Link>
      ) : null}
    </div>
  );
}

/** Marks months completed in one click (with Undo in the toast) */
export function MarkCompletedButton({
  country,
  periods,
  size = 'sm',
  label,
  variant = 'primary',
}: {
  country: Country;
  periods: string[];
  size?: 'sm' | 'md';
  label?: string;
  variant?: 'primary' | 'secondary';
}) {
  const { busy, setMonths } = useSetMonths();
  return (
    <Button
      size={size}
      variant={variant}
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

/** Takes months out of "extracting", back to not done (files stay; Undo in the toast) */
export function RemoveMonthsButton({ country, periods, size = 'sm', label = 'Remove' }: { country: Country; periods: string[]; size?: 'sm' | 'md'; label?: string }) {
  const { busy, setMonths } = useSetMonths();
  return (
    <Button
      size={size}
      variant="ghost"
      className="btn-danger-ghost"
      icon={<Icon.X size={13} />}
      loading={busy}
      title={`Take ${fmtRange(periods)} out of extracting, back to not done. Files are kept.`}
      onClick={(e) => {
        e.stopPropagation();
        setMonths(country, periods, null);
      }}
    >
      {label}
    </Button>
  );
}

/**
 * The button for a country's next step: follow the running extraction, extract or upload what is
 * due, or nothing when it is up to date. (Months to check have their own buttons.)
 */
export function NextAction({ country, status, size = 'sm' }: { country: Country; status: CountryStatus; size?: 'sm' | 'md' }) {
  const extractability = useExtractability();
  const { next } = status;

  if (next.kind === 'review') return <MarkCompletedButton country={country} periods={next.periods} size={size} />;
  if (next.kind === 'running') {
    return (
      <Link href={`/extractions/${next.run.id}`} className={`btn btn-secondary btn-${size}`}>
        <StatusDot tone="blue" live /> View progress
      </Link>
    );
  }
  if (next.kind === 'done') return null;
  if (country.kind === 'manual') {
    return (
      <Link href={`/countries/${country.code}#upload`} className={`btn btn-secondary btn-${size}`}>
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
    <Link href={extractHref(country.code, next.periods)} className={`btn btn-primary btn-${size}`}>
      <Icon.Play size={13} /> Extract {monthsWord(next.periods)}
    </Link>
  );
}
