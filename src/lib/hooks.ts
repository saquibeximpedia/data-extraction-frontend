'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { errorText } from './result';

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
