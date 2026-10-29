'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePopover, FloatingPanel } from './popover';
import { Icon } from './icons';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  /** Draws a divider above this item */
  separator?: boolean;
  danger?: boolean;
  /** Marks the current item (e.g. the page you are on) */
  active?: boolean;
  /** Leaves the menu open after selecting (e.g. a toggle whose label changes) */
  keepOpen?: boolean;
}

/**
 * Dropdown of actions, e.g. on a table row. Floats above scroll containers.
 * The trigger is a "more" icon unless `trigger` gives its content and class; `header` sits above the items.
 */
export function Menu({
  items,
  label = 'More actions',
  trigger,
  header,
  width = 248,
}: {
  items: MenuItem[];
  label?: string;
  trigger?: { content: React.ReactNode; className: string };
  header?: React.ReactNode;
  width?: number;
}) {
  const { open, setOpen, close, rootRef, triggerRef, panelRef } = usePopover();
  const dismiss = useCallback(() => setOpen(false), [setOpen]);

  return (
    <div className="popover-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={trigger?.className ?? 'btn btn-ghost btn-sm btn-icon'}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger?.content ?? <Icon.More />}
      </button>
      {open && (
        <FloatingPanel anchor={triggerRef.current} panelRef={panelRef} onDismiss={dismiss} width={width} role="menu">
          <MenuItems items={items} header={header} close={close} />
        </FloatingPanel>
      )}
    </div>
  );
}

/** A menu's header and items; links close it with `close(false)`, without moving focus back */
function MenuItems({ items, header, close }: { items: MenuItem[]; header?: React.ReactNode; close: (refocus?: boolean) => void }) {
  return (
    <>
      {header && <div className="menu-header">{header}</div>}
      {items.map((item, i) => {
        const content = (
          <>
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-label">{item.label}</span>
          </>
        );
        const className = `menu-item ${item.danger ? 'menu-item-danger' : ''} ${item.active ? 'menu-item-active' : ''}`;
        return (
          <div key={i}>
            {item.separator && (i > 0 || !header) && <div className="menu-sep" />}
            {item.href ? (
              <Link role="menuitem" className={className} href={item.href} aria-current={item.active ? 'page' : undefined} onClick={() => close(false)}>
                {content}
              </Link>
            ) : (
              <button
                role="menuitem"
                type="button"
                className={className}
                onClick={() => {
                  item.onSelect?.();
                  if (!item.keepOpen) close();
                }}
              >
                {content}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

/**
 * A menu opened at the pointer, e.g. on right-click (`at` from the contextmenu event). Kept inside
 * the window; closes on a click elsewhere, Escape, scrolling or resizing.
 */
export function ContextMenu({
  at,
  items,
  header,
  onClose,
  width = 220,
  label,
}: {
  at: { x: number; y: number } | null;
  items: MenuItem[];
  header?: React.ReactNode;
  onClose: () => void;
  width?: number;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Placed once its height is known, flipped up or left near the window's edges
  useLayoutEffect(() => {
    if (!at || !ref.current) return setPos(null);
    const { height } = ref.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(at.x, window.innerWidth - width - 8));
    const top = at.y + height + 8 > window.innerHeight ? Math.max(8, at.y - height) : at.y;
    setPos({ top, left });
  }, [at, width]);

  useEffect(() => {
    if (!at) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus({ preventScroll: true });
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [at, onClose]);

  if (!at) return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="popover surface-pop popover-floating"
      style={{ position: 'fixed', top: pos?.top ?? at.y, left: pos?.left ?? at.x, width, visibility: pos ? 'visible' : 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItems items={items} header={header} close={onClose} />
    </div>,
    document.body
  );
}
