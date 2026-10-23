'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from './store';
import type { Country } from './types';

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
