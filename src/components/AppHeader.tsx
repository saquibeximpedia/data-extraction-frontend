'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/store';
import { Icon, ThemeToggle } from './ui';

// `section` is the path prefix the tab stays lit for (country pages belong to the dashboard)
const DASHBOARD = { href: '/', section: '/countries', label: 'Dashboard' };
const EXTRACT = { href: '/extract', section: '/extract', label: 'Extract' };
const EXTRACTIONS = { href: '/extractions', section: '/extractions', label: 'Extractions' };
const FILES = { href: '/files', section: '/files', label: 'Files' };
const ADMIN = { href: '/admin/users', section: '/admin', label: 'Admin' };

/** Whether the extraction service is up; opens Settings, where its URL is set */
function ServicePill({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const { service } = useApp();
  const label = service.status === 'live' ? 'Extractor live' : service.status === 'offline' ? 'Extractor offline' : 'Checking…';
  const dot = service.status === 'live' ? 'dot-green dot-live' : service.status === 'offline' ? 'dot-red' : '';
  const title =
    service.status === 'live'
      ? `Extraction service at ${service.url}`
      : service.status === 'offline'
        ? `Extraction service at ${service.url}: ${service.error} Click to change the URL.`
        : `Checking ${service.url}`;
  return (
    <Link href="/settings" className={`glass-btn glass service-pill service-${service.status}`} title={title} onClick={() => onNavigate?.('/settings')}>
      <span className={`dot ${dot}`} />
      <span className="glass-btn-label">{label}</span>
    </Link>
  );
}

/** Page tabs (Extract while the service is live, Admin for admins), service status, theme and sign out */
export function AppHeader({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const pathname = usePathname();
  const { runs, me, isAdmin, signOut, serviceLive } = useApp();
  const tabs = [DASHBOARD, ...(serviceLive ? [EXTRACT] : []), EXTRACTIONS, FILES, ...(isAdmin ? [ADMIN] : [])];
  const runningCount = runs?.filter((r) => r.status === 'RUNNING').length ?? 0;

  // '/extract' must not light up for '/extractions'; no tab is lit on pages outside them (e.g. Settings)
  const activeIndex = tabs.findIndex((t) => pathname === t.href || pathname === t.section || pathname.startsWith(t.section + '/'));
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = tabRefs.current[activeIndex];
      if (!el) return setIndicator(null);
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
      // On phones the tab pill scrolls sideways; keep the current page's tab in view
      const nav = el.parentElement;
      if (nav && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [activeIndex, runningCount, tabs.length]);

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
            className={`nav-tab ${i === activeIndex ? 'active' : ''} ${t === EXTRACT ? 'nav-tab-extract' : ''}`}
            aria-current={i === activeIndex ? 'page' : undefined}
            onClick={(e) => {
              // Let modified clicks (new tab, etc.) behave normally
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) onNavigate?.(t.href);
            }}
          >
            {t === EXTRACT && <Icon.Play size={13} />}
            {t.label}
            {t === EXTRACTIONS && runningCount > 0 && <span className="nav-badge live">{runningCount}</span>}
          </Link>
        ))}
      </nav>

      <div className="nav-side">
        <ServicePill onNavigate={onNavigate} />
        <ThemeToggle />
        <button type="button" className="glass-btn glass glass-btn-icon" onClick={signOut} title={me ? `Sign out (${me.email}${isAdmin ? ', admin' : ''})` : 'Sign out'} aria-label="Sign out">
          <Icon.Logout size={15} />
        </button>
      </div>
    </header>
  );
}
