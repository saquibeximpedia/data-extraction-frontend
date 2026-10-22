'use client';

import { useEffect, useRef, useState } from 'react';

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
