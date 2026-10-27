'use client';

import { useCallback, useState } from 'react';
import { fmtRange, plural } from '@/lib/format';
import { monthState } from '@/lib/months';
import { errorText, unwrap } from '@/lib/result';
import type { Country, MonthStatus } from '@/lib/types';
import { setMonths as saveMonths } from '@/modules/countries/actions';
import { monthsWord } from '@/modules/countries/status';
import { Button, Icon, useToast } from './ui';

/**
 * Sets months of a country to one status (null clears them) and confirms with a toast that can
 * undo it. Every page's data refreshes from the server. Resolves to whether it saved.
 */
export function useSetMonths() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const setMonths = useCallback(
    async (country: Country, periods: string[], status: MonthStatus | null): Promise<boolean> => {
      if (!periods.length) return false;
      const before = periods.map((period) => {
        const s = monthState(country, period);
        return { period, status: s === 'none' ? null : s };
      });
      setBusy(true);
      try {
        await unwrap(saveMonths(country.code, periods.map((period) => ({ period, status }))));
        toast('ok', `${country.name}: ${plural(periods.length, 'month')} ${status ? `marked ${status}` : 'cleared'}`, fmtRange(periods), {
          label: 'Undo',
          onClick: () => unwrap(saveMonths(country.code, before)).catch((err) => toast('err', 'Could not undo', errorText(err))),
        });
        return true;
      } catch (err) {
        toast('err', 'Could not save the months', errorText(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );

  return { busy, setMonths };
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
