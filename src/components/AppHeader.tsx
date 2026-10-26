'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/store';
import { isRunning } from '@/lib/runs';
import { Icon, Menu, StatusDot, ThemeToggle } from './ui';

// `section` is the path prefix the tab stays lit for
const DASHBOARD = { href: '/', section: '/', label: 'Dashboard' };
const COUNTRIES = { href: '/countries', section: '/countries', label: 'Countries' };
const EXTRACT = { href: '/extract', section: '/extract', label: 'Extract' };
const EXTRACTIONS = { href: '/extractions', section: '/extractions', label: 'Extractions' };
const FILES = { href: '/files', section: '/files', label: 'Files' };
const USERS = { href: '/users', section: '/users', label: 'Users' };

const SERVICE_LABEL = { live: 'Extractor live', offline: 'Extractor offline', checking: 'Checking the extractor…' };

/** Whether the extraction service is up, as a dot; opens Settings, where its URL is set */
function ServiceDot({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const { service } = useApp();
  const label =
    service.status === 'offline' ? `${SERVICE_LABEL.offline} at ${service.url}: ${service.error} Click to change the URL.` : `${SERVICE_LABEL[service.status]} at ${service.url}`;
  return (
    <Link href="/settings" className={`icon-btn service-dot service-${service.status}`} aria-label={label} title={label} onClick={() => onNavigate?.('/settings')}>
      <StatusDot tone={service.status === 'live' ? 'green' : service.status === 'offline' ? 'red' : undefined} live={service.status === 'offline'} />
    </Link>
  );
}

/** The signed-in account, Settings and sign out */
function AccountMenu() {
  const { me, isAdmin, signOut } = useApp();
  return (
    <Menu
      label="Account"
      width={240}
      trigger={{ className: 'avatar-btn', content: <span className="avatar">{(me?.email ?? '?').charAt(0).toUpperCase()}</span> }}
      header={
        <>
          <span className="menu-header-name">{me?.email}</span>
          <span className="menu-header-sub">{isAdmin ? 'Admin' : 'User'}</span>
        </>
      }
      items={[
        { label: 'Settings', icon: <Icon.Gear size={15} />, href: '/settings' },
        { label: 'Sign out', icon: <Icon.Logout size={15} />, onSelect: signOut, separator: true },
      ]}
    />
  );
}

/**
 * Floating glass pills: the pages (a sliding pill marks the current one) and, on the right, the
 * service status, theme and account. On small screens the pages fold into a menu.
 */
export function AppHeader({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const pathname = usePathname();
  const { runs, isAdmin } = useApp();
  const tabs = [DASHBOARD, COUNTRIES, EXTRACT, EXTRACTIONS, FILES, ...(isAdmin ? [USERS] : [])];
  const runningCount = runs?.filter(isRunning).length ?? 0;

  // '/extract' must not light up for '/extractions'; no tab is lit on pages outside them (e.g. Settings)
  const activeIndex = tabs.findIndex((t) => pathname === t.href || (t.section !== '/' && pathname.startsWith(t.section + '/')));
  const current = tabs[activeIndex];
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = tabRefs.current[activeIndex];
      setIndicator(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [activeIndex, runningCount, tabs.length]);

  const go = (href: string) => (e: React.MouseEvent) => {
    // Let modified clicks (new tab, etc.) behave normally
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) onNavigate?.(href);
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-start">
          <Menu
            label="Pages"
            width={220}
            trigger={{
              className: 'page-menu-btn glass',
              content: (
                <>
                  <Icon.List size={16} /> {current?.label ?? 'Menu'}
                </>
              ),
            }}
            items={tabs.map((t, i) => ({
              label: t === EXTRACTIONS && runningCount ? `${t.label} · ${runningCount} running` : t.label,
              href: t.href,
              active: i === activeIndex,
            }))}
          />
        </div>

        <nav className="tabs glass" aria-label="Pages">
          {indicator && <span className="tab-indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />}
          {tabs.map((t, i) => (
            <Link
              key={t.href}
              href={t.href}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              className={`tab ${i === activeIndex ? 'active' : ''}`}
              aria-current={i === activeIndex ? 'page' : undefined}
              onClick={go(t.href)}
            >
              {t.label}
              {t === EXTRACTIONS && runningCount > 0 && (
                <span className="tab-badge" title={`${runningCount} running`}>
                  {runningCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="topbar-side glass">
          <ServiceDot onNavigate={onNavigate} />
          <Link href="/settings" className="icon-btn" aria-label="Settings" title="Settings" onClick={go('/settings')}>
            <Icon.Gear size={17} />
          </Link>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
