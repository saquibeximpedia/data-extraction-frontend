'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/store';
import { PageHead } from '@/components/PageHead';
import { Empty, Panel } from '@/components/ui';

const SECTIONS = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/countries', label: 'Countries' },
];

/** Every /admin page: admins only, with tabs between the sections */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useApp();
  const pathname = usePathname();
  if (!isAdmin) {
    return (
      <Panel>
        <Empty>Only admins can open this page.</Empty>
      </Panel>
    );
  }

  return (
    <>
      <PageHead title="Admin" sub="Manage accounts and the country details users see." />
      <nav className="year-tabs admin-tabs reveal" aria-label="Admin sections">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className={`year-tab ${pathname === s.href ? 'active' : ''}`} aria-current={pathname === s.href ? 'page' : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
