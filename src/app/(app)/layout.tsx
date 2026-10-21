'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { AppHeader } from '@/components/AppHeader';
import { ListPageSkeleton, OverviewSkeleton } from '@/components/PageSkeletons';

function skeletonFor(href: string) {
  if (href === '/runs') return <ListPageSkeleton titleWidth={110} />;
  if (href === '/files') return <ListPageSkeleton titleWidth={100} />;
  return <OverviewSkeleton />;
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

  useEffect(() => {
    if (auth === 'out' || auth === 'expired') router.replace(auth === 'expired' ? '/login?expired=1' : '/login');
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
