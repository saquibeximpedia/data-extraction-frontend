'use client';

import Link from 'next/link';
import { MarkCompletedButton, RemoveMonthsButton } from '@/components/month-actions';
import { RunProgress } from '@/components/run-progress';
import { StepCard } from '@/components/step-card';
import { Icon, revealStyle, StatTiles, StatusDot, When } from '@/components/ui';
import { fmtMonth, fmtNumber, fmtRange, plural } from '@/lib/format';
import { extractHref } from '@/lib/runs';
import type { Country, Run } from '@/lib/types';
import { useExtractability } from '@/modules/service/store';
import { useCountryStatus } from '../hooks';
import { describeStep, monthsWord, type CountryStatus } from '../status';

/** The Extract button in the country's head: primary while the service can extract it */
export function ExtractLink({ country, running }: { country: Country; running: Run[] }) {
  const extractability = useExtractability();
  const { due } = useCountryStatus(country, running);
  return (
    <Link href={extractHref(country.code, due)} className={`btn btn-md ${extractability(country.code).ok ? 'btn-primary' : 'btn-secondary'}`}>
      <Icon.Play size={13} /> Extract
    </Link>
  );
}

/** The button for a country's next step when it isn't months to check: follow the run, or extract / upload what is due */
function NextAction({ country, status }: { country: Country; status: CountryStatus }) {
  const extractability = useExtractability();
  const { next } = status;

  if (next.kind === 'running') {
    return (
      <Link href={`/extractions/${next.run.id}`} className="btn btn-secondary btn-md">
        <StatusDot tone="blue" live /> View progress
      </Link>
    );
  }
  if (next.kind !== 'due') return null;
  if (country.kind === 'manual') {
    return (
      <Link href={`/countries/${country.code}#upload`} className="btn btn-secondary btn-md">
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
    <Link href={extractHref(country.code, next.periods)} className="btn btn-primary btn-md">
      <Icon.Play size={13} /> Extract {monthsWord(next.periods)}
    </Link>
  );
}

/**
 * A country's headline numbers, then its next step spelled out: check and mark extracted months,
 * follow the running extraction, or extract / upload what is due.
 */
export function CountryOverview({ country, running }: { country: Country; running: Run[] }) {
  const status = useCountryStatus(country, running);
  const { latest, behind, next } = status;
  const completed = country.completedMonths;
  const step = describeStep(country, status);

  return (
    <>
      <StatTiles
        i={1}
        tiles={[
          {
            label: 'Latest completed',
            value: country.latestCompleted ? fmtMonth(country.latestCompleted) : 'None yet',
            sub: behind === null ? (latest ? `${fmtMonth(latest)} is out` : '') : behind === 0 ? 'Up to date' : `${plural(behind, 'month')} behind`,
            tone: behind === 0 ? 'green' : behind ? 'amber' : '',
          },
          { label: 'Months completed', value: fmtNumber(completed.length), sub: completed.length ? (completed.length === 1 ? fmtMonth(completed[0]) : `since ${fmtMonth(completed[0])}`) : '' },
          {
            label: 'To check',
            value: fmtNumber(status.review.length),
            sub: status.review.length ? fmtRange(status.review) : status.running ? 'Extracting now' : 'Nothing waiting',
            tone: status.review.length ? 'amber' : '',
          },
          { label: 'Last extracted', value: country.lastExtractedAt ? <When value={country.lastExtractedAt} as="relative" /> : 'Never', sub: <When value={country.lastExtractedAt} /> },
        ]}
      />

      {next.kind !== 'done' && (
        <StepCard
          kind={next.kind}
          className="reveal"
          style={revealStyle(2)}
          label={
            <>
              <StatusDot tone={step.tone} live={next.kind === 'running'} /> Next step
            </>
          }
          title={step.text}
          actions={
            next.kind === 'review' ? (
              <>
                <RemoveMonthsButton country={country} periods={next.periods} size="md" />
                <Link href={`/files?country=${country.code}`} className="btn btn-secondary btn-md">
                  <Icon.Folder size={14} /> Check files
                </Link>
                <MarkCompletedButton country={country} periods={next.periods} size="md" />
              </>
            ) : (
              <NextAction country={country} status={status} />
            )
          }
        >
          {next.kind === 'running' && <RunProgress run={next.run} />}
          {next.kind === 'review' && (
            <span className="next-step-help">
              Extracted months stay <b>extracting</b> until someone checks the files. Mark them completed once the files look right, or remove them to set them
              back to not done.{' '}
              <a href="#edit-months" className="text-btn">
                Change only some
              </a>
            </span>
          )}
        </StepCard>
      )}
    </>
  );
}
