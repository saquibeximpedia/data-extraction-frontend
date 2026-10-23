'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/store';
import { Icon, ThemeToggle } from './ui';

// `section` is the path prefix the tab stays lit for (country pages belong to the dashboard)
const TABS = [
  { href: '/', section: '/countries', label: 'Dashboard' },
  { href: '/extract', section: '/extract', label: 'Extract' },
  { href: '/extractions', section: '/extractions', label: 'Extractions' },
  { href: '/files', section: '/files', label: 'Files' },
];
const ADMIN_TAB = { href: '/admin/users', section: '/admin', label: 'Admin' };

/** Page tabs (Admin for admins), theme and sign out. A tab click lets the layout show that page's skeleton. */
export function AppHeader({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const pathname = usePathname();
  const { runs, files, me, isAdmin, signOut } = useApp();
  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;
  const runningCount = runs?.filter((r) => r.status === 'RUNNING').length ?? 0;

  // '/extract' must not light up for '/extractions'
  const activeIndex = Math.max(0, tabs.findIndex((t) => pathname === t.href || pathname === t.section || pathname.startsWith(t.section + '/')));
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = tabRefs.current[activeIndex];
      if (!el) return;
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
      // On phones the tab pill scrolls sideways; keep the current page's tab in view
      const nav = el.parentElement;
      if (nav && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [activeIndex, runningCount, files?.length, tabs.length]);

  const badges: Record<string, React.ReactNode> = {
    '/extractions': runningCount > 0 ? <span className="nav-badge live">{runningCount}</span> : null,
    '/files': files?.length ? <span className="nav-badge">{files.length}</span> : null,
  };

  return (
    <header className="nav-wrap">
      <nav className="nav glass" aria-label="Pages">
        {indicator && <span className="nav-indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />}
        {tabs.map((t, i) => (
          <Link
            key={t.href}
            href={t.href}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            className={`nav-tab ${i === activeIndex ? 'active' : ''}`}
            aria-current={i === activeIndex ? 'page' : undefined}
            onClick={(e) => {
              // Let modified clicks (new tab, etc.) behave normally
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) onNavigate?.(t.href);
            }}
          >
            {t.label}
            {badges[t.href]}
          </Link>
        ))}
      </nav>

      <div className="nav-side">
        <ThemeToggle />
        <button type="button" className="glass-btn glass" onClick={signOut} title={me ? `Signed in as ${me.email}${isAdmin ? ' (admin)' : ''}` : undefined}>
          <Icon.Logout size={15} />
          <span className="glass-btn-label">Sign out</span>
        </button>
      </div>
    </header>
  );
}
