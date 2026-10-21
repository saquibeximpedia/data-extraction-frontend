'use client';

import { useEffect, useRef, useState } from 'react';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animates a number from its previous value to `target` so changes are noticeable */
export function useCountUp(target: number | undefined, durationMs = 600): number | undefined {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target ?? 0);

  useEffect(() => {
    if (target === undefined) return;
    const from = fromRef.current;
    fromRef.current = target;
    if (from === target || reducedMotion()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

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
