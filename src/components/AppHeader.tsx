'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/store';
import { Icon, ThemeToggle } from './ui';

const TABS = [
  { href: '/', label: 'Overview' },
  { href: '/runs', label: 'Runs' },
  { href: '/files', label: 'Files' },
];

/**
 * Floating glass navigation: pages on the left, theme and log out on the right.
 * The raised pill marks the current page only; hover is a faint tint.
 * Clicking a tab tells the layout, which shows that page's skeleton until it renders.
 */
export function AppHeader({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const pathname = usePathname();
  const { runs, files, logout } = useApp();
  const runningCount = runs?.filter((r) => r.status === 'RUNNING').length ?? 0;

  const activeIndex = Math.max(0, TABS.findIndex((t) => (t.href === '/' ? pathname === '/' : pathname.startsWith(t.href))));
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = tabRefs.current[activeIndex];
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [activeIndex, runningCount, files?.length]);

  const badges: Record<string, React.ReactNode> = {
    '/runs': runningCount > 0 ? <span className="nav-badge live">{runningCount}</span> : null,
    '/files': files?.length ? <span className="nav-badge">{files.length}</span> : null,
  };

  return (
    <header className="nav-wrap">
      <nav className="nav glass" aria-label="Pages">
        {indicator && <span className="nav-indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />}
        {TABS.map((t, i) => (
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
        <button type="button" className="glass-btn glass" onClick={logout}>
          <Icon.Logout size={15} />
          Log out
        </button>
      </div>
    </header>
  );
}
