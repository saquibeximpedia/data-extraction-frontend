'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/modules/auth/actions';
import { useApp } from '@/modules/service/store';
import { Icon, Menu, StatusDot, useTheme } from './ui';

// `section` is the path prefix the tab stays lit for
const DASHBOARD = { href: '/', section: '/', label: 'Dashboard' };
const COUNTRIES = { href: '/countries', section: '/countries', label: 'Countries' };
const EXTRACT = { href: '/extract', section: '/extract', label: 'Extract' };
const EXTRACTIONS = { href: '/extractions', section: '/extractions', label: 'Extractions' };
const FILES = { href: '/files', section: '/files', label: 'Files' };
const USERS = { href: '/users', section: '/users', label: 'Users' };

const SERVICE_LABEL = { live: 'Live', offline: 'Offline', checking: 'Checking…' };

/** Whether the extraction service is live, beside the account button; opens its page, where its URL is set */
function ServiceStatus() {
  const { service } = useApp();
  const tone = service.status === 'live' ? 'green' : service.status === 'offline' ? 'red' : undefined;
  const title = service.status === 'offline' ? `Extractor offline at ${service.url}: change its URL` : `Extractor ${SERVICE_LABEL[service.status].toLowerCase()} at ${service.url}`;
  return (
    <Link href="/service" className={`service-pill glass service-${service.status}`} title={title} aria-label={title}>
      <StatusDot tone={tone} live={service.status === 'offline'} />
      <span className="service-pill-label">{SERVICE_LABEL[service.status]}</span>
    </Link>
  );
}

/** The account button; its menu holds the extraction service, Settings, the theme (switching it keeps the menu open) and sign out */
function AccountMenu() {
  const { me, isAdmin } = useApp();
  const { theme, toggle } = useTheme();
  return (
    <Menu
      label="Account"
      width={240}
      trigger={{
        className: 'avatar-btn glass',
        content: <span className="avatar">{me.username.charAt(0).toUpperCase()}</span>,
      }}
      header={
        <>
          <span className="menu-header-name">{me.username}</span>
          <span className="menu-header-sub">{isAdmin ? 'Admin' : 'User'}</span>
        </>
      }
      items={[
        { label: 'Extraction service', icon: <Icon.Plug size={15} />, href: '/service' },
        { label: 'Settings', icon: <Icon.Gear size={15} />, href: '/settings' },
        { label: theme === 'dark' ? 'Light theme' : 'Dark theme', icon: theme === 'dark' ? <Icon.Sun size={15} /> : <Icon.Moon size={15} />, onSelect: toggle, keepOpen: true },
        { label: 'Sign out', icon: <Icon.Logout size={15} />, onSelect: () => signOut(), separator: true },
      ]}
    />
  );
}

/**
 * Floating glass pills: the pages (a sliding pill marks the current one) and, on the right, the
 * service status and account. On small screens the pages fold into a menu.
 */
export function AppHeader() {
  const pathname = usePathname();
  const { liveRuns, isAdmin } = useApp();
  const tabs = [DASHBOARD, COUNTRIES, EXTRACT, EXTRACTIONS, FILES, ...(isAdmin ? [USERS] : [])];
  const runningCount = liveRuns.length;

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

        <div className="topbar-side">
          <ServiceStatus />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
