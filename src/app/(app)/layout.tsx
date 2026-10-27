'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { capitalize } from '@/lib/format';
import { describeRun } from '@/lib/runs';
import type { Run } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { skeletonFor } from '@/components/PageSkeletons';
import { useToast } from '@/components/ui';

/** Says when an extraction ends, on whatever page you are, with a link to its results */
function useRunEndedToasts() {
  const { runs } = useApp();
  const toast = useToast();
  const router = useRouter();
  const seen = useRef<Map<string, Run['status']> | null>(null);

  useEffect(() => {
    // Signed out: start over, so the next sign-in doesn't announce what ended meanwhile
    if (!runs) {
      seen.current = null;
      return;
    }
    const before = seen.current;
    // Statuses of runs missing from this list are kept: a live run can drop out briefly before the history has its end
    seen.current = new Map([...(before ?? []), ...runs.map((r) => [r.id, r.status] as const)]);
    if (!before) return;
    for (const run of runs) {
      if (before.get(run.id) !== 'RUNNING' || run.status === 'RUNNING') continue;
      const ok = run.status === 'COMPLETED';
      toast(ok ? 'ok' : 'err', ok ? 'Extraction finished: check the files' : `Extraction ${capitalize(run.status).toLowerCase()}`, describeRun(run), {
        label: ok ? 'Review' : 'Open',
        onClick: () => router.push(`/extractions/${run.id}`),
      });
    }
  }, [runs, toast, router]);
}

/**
 * Every signed-in page: redirects to /login without a session and shares the header.
 * After a tab is clicked, the page area shows that page's skeleton until it renders.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { auth } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  useRunEndedToasts();

  useEffect(() => {
    if (auth === 'out') router.replace('/login');
  }, [auth, router]);

  // The new page has rendered once the path changes
  useEffect(() => setPending(null), [pathname]);

  if (auth !== 'in') return null;

  return (
    <>
      <AppHeader onNavigate={(href) => href !== pathname && setPending(href)} />
      <main className="page">{pending ? skeletonFor(pending) : children}</main>
    </>
  );
}
