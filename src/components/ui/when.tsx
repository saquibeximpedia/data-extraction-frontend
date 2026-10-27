'use client';

import { useEffect, useState } from 'react';
import { fmtDate, fmtDay, fmtRelative, fmtTime } from '@/lib/format';

const FORMATS = { date: fmtDate, time: fmtTime, day: fmtDay, relative: fmtRelative };

/**
 * A moment in the reader's own time zone and locale. The server renders it in its own, so the
 * text is swapped once the page is running in the browser. `title` adds the full date on hover.
 */
export function When({ value, as = 'date', title }: { value: string | null | undefined; as?: keyof typeof FORMATS; title?: boolean }) {
  const [, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!value) return null;
  return (
    <span suppressHydrationWarning title={title ? fmtDate(value) : undefined}>
      {FORMATS[as](value)}
    </span>
  );
}
