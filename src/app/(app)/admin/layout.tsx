'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/store';
import { PageHead } from '@/components/PageHead';

const SECTIONS = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/user/create', label: 'New user' },
  { href: '/admin/country/edit', label: 'Countries' },
];

/** Every /admin page: admins only, with links between the sections */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useApp();
  const pathname = usePathname();
  if (!isAdmin) return <p className="empty">Only admins can open this page.</p>;

  return (
    <>
      <PageHead title="Admin" sub="Manage accounts and the country details users see." />
      <nav className="chip-group reveal" aria-label="Admin sections">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className={`chip-btn chip-link ${pathname === s.href ? 'active' : ''}`} aria-current={pathname === s.href ? 'page' : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
