'use client';

import { useEffect, useRef, useState } from 'react';

/** How long the leave animations in globals.css run (`.closing`) */
export const EXIT_MS = 150;

/**
 * Keeps something on screen for its leave animation after `open` turns false: `mounted` says
 * whether to render it, `closing` whether it is on its way out (give it the `closing` class).
 */
export function usePresence(open: boolean, ms = EXIT_MS) {
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) return setShown(true);
    const timer = setTimeout(() => setShown(false), ms);
    return () => clearTimeout(timer);
  }, [open, ms]);
  return { mounted: open || shown, closing: !open && shown };
}

/**
 * The last value seen while `open`: what was on screen stays as it was while it animates out,
 * even though whatever it showed is already gone (e.g. a dialog's selection cleared on close).
 */
export function useLatched<T>(value: T, open: boolean): T {
  const last = useRef(value);
  if (open) last.current = value;
  return open ? value : last.current;
}

/** A block that animates in, and folds away once `open` turns false (e.g. a section a toggle opens) */
export function Collapsible({ open, className = '', children }: { open: boolean; className?: string; children: React.ReactNode }) {
  const { mounted, closing } = usePresence(open);
  const content = useLatched(children, open);
  if (!mounted) return null;
  return (
    <div className={`collapsible ${closing ? 'closing' : ''}`}>
      <div className={className}>{content}</div>
    </div>
  );
}
