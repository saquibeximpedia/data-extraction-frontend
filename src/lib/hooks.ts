'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { api, errorText } from './api';
import { fmtRange, plural } from './format';
import { monthState } from './months';
import { countryStatus, type CountryStatus } from './status';
import { useApp } from './store';
import type { Country, MonthStatus } from './types';

/**
 * Returns the keys whose signature changed since the last render (or are new),
 * skipping the very first load so the initial list doesn't all light up.
 */
export function useChangedKeys(items: { key: string; signature: string }[]): Set<string> {
  const previous = useRef<Map<string, string> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const fingerprint = items.map((i) => `${i.key}:${i.signature}`).join('|');

  useEffect(() => {
    const next = new Map(items.map((i) => [i.key, i.signature]));
    if (previous.current) {
      const prev = previous.current;
      const diff = new Set(items.filter((i) => prev.get(i.key) !== i.signature).map((i) => i.key));
      if (diff.size) {
        setChanged(diff);
        const timer = setTimeout(() => setChanged(new Set()), 1800);
        previous.current = next;
        return () => clearTimeout(timer);
      }
    }
    previous.current = next;
  }, [fingerprint]);

  return changed;
}

/** A country from the loaded list: undefined while loading, null when there is no such code */
export function useCountry(code: string): Country | null | undefined {
  const { countries } = useApp();
  if (!countries) return undefined;
  return countries.find((c) => c.code === code.toUpperCase()) ?? null;
}

/** What each country needs next (see countryStatus), by code */
export function useCountryStatuses(): Map<string, CountryStatus> {
  const { countries, runs } = useApp();
  return useMemo(() => new Map((countries ?? []).map((c) => [c.code, countryStatus(c, runs)])), [countries, runs]);
}

export function useCountryStatus(country: Country): CountryStatus {
  const { runs } = useApp();
  return useMemo(() => countryStatus(country, runs), [country, runs]);
}

/**
 * Whether the live extraction service can extract a country right now.
 * reason: 'offline' when the service is down (callers usually just hide the action), otherwise
 * a sentence saying why not.
 */
export function useExtractability() {
  const { serviceLive, extractors } = useApp();
  return useCallback(
    (code: string): { ok: boolean; reason: string } => {
      if (!serviceLive) return { ok: false, reason: 'offline' };
      if (!extractors) return { ok: false, reason: 'Loading what the extraction service supports…' };
      const info = extractors.find((e) => e.code === code);
      if (!info) return { ok: false, reason: `The extraction service has no extractor for ${code}.` };
      if (!info.enabled) return { ok: false, reason: `Disabled on the extraction service: set ${info.missingConfig.join(', ')} in its .env.` };
      return { ok: true, reason: '' };
    },
    [serviceLive, extractors]
  );
}

/**
 * Runs an action with a busy flag and a toast for the outcome. `run` resolves to the task's
 * result, or undefined when it failed (the error is already shown).
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(task: () => Promise<T>, success: string | ((result: T) => string), then?: (result: T) => void, failure = 'Could not save'): Promise<T | undefined> => {
      setBusy(true);
      try {
        const result = await task();
        if (success) toast('ok', typeof success === 'function' ? success(result) : success);
        then?.(result);
        return result;
      } catch (err) {
        toast('err', failure, errorText(err));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );
  return { busy, run };
}

/**
 * Sets months of a country to one status (null clears them), updates the country everywhere,
 * and confirms with a toast that can undo it. Resolves to whether it saved.
 */
export function useSetMonths() {
  const { putCountry } = useApp();
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
        const r = await api.setMonths(country.code, periods.map((period) => ({ period, status })));
        putCountry(r.country);
        toast('ok', `${country.name}: ${plural(periods.length, 'month')} ${status ? `marked ${status}` : 'cleared'}`, fmtRange(periods), {
          label: 'Undo',
          onClick: () =>
            api
              .setMonths(country.code, before)
              .then((u) => putCountry(u.country))
              .catch((err) => toast('err', 'Could not undo', errorText(err))),
        });
        return true;
      } catch (err) {
        toast('err', 'Could not save the months', errorText(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [putCountry, toast]
  );

  return { busy, setMonths };
}

/**
 * Props that make a table row open `href` when clicked anywhere on it. Links, buttons and inputs
 * inside the row keep their own destination; Ctrl / Cmd / middle click opens a new tab.
 */
export function useRowLink() {
  const router = useRouter();
  return useCallback(
    (href: string) => ({
      className: 'clickable',
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        if ((e.target as HTMLElement).closest('a, button, input, label')) return;
        if (e.metaKey || e.ctrlKey) window.open(href, '_blank', 'noopener');
        else router.push(href);
      },
      onAuxClick: (e: React.MouseEvent<HTMLElement>) => {
        if (e.button === 1 && !(e.target as HTMLElement).closest('a, button')) window.open(href, '_blank', 'noopener');
      },
    }),
    [router]
  );
}
